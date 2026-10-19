# Job Talend – IN37-2 Rapprochement financier (SAP ACDOCA → BDD intermédiaire LTRF)

Ce job reprend la spécification `PULSE_XBL FR IT-IT-19934 - IN37-2 Rapprochement financier.pdf`
(le résumé est dans `RESUME_IN37-2.md`).

Dans la spécification, l'extraction passe par SAP PO (ABAP Proxy). Ce job Talend fait la même
chaîne de bout en bout :

- **Source** : S/4HANA en lecture directe sur la base HANA (`ACDOCA`, `BSEG`, `SETLEAF`, `TVARVC`,
  `T001K`, `T001W`, `ZREF_CP`, `CSKS`, `ZFI_DIF_TRACK`).
- **Cible** : la BDD intermédiaire LTRF, sur Oracle.

Si vous n'avez pas d'accès JDBC à HANA, remplacez les `tDBInput` HANA par des `tSAPTableInput`.
Les filtres restent les mêmes, mais les sous-requêtes du périmètre doivent alors passer par des
lookups `tMap`.

## Fichiers fournis

| Fichier | Rôle |
|---|---|
| `sql/01_ddl_bdd_intermediaire_oracle.sql` | Tables cibles, transco RG03, delta, journal et rejets |
| `sql/02_extraction_acdoca_hana.sql` | Les 3 requêtes d'extraction (flux 1, 2 et 3) |
| `routines/RapproFiUtils.java` | Routine Talend (clé, débit/crédit, mode de paiement, dates SAP, RG00) |

## Variables de contexte (groupe `CTX_IN37_2`)

| Variable | Type | Exemple / rôle |
|---|---|---|
| `SAP_HANA_HOST`, `SAP_HANA_PORT`, `SAP_HANA_SCHEMA`, `SAP_HANA_USER`, `SAP_HANA_PWD` | String | Connexion HANA (D01, puis Q01 et P01) |
| `SAP_MANDT` | String | `100` |
| `ORA_HOST`, `ORA_PORT`, `ORA_SID`, `ORA_USER`, `ORA_PWD` | String | Connexion à la BDD LTRF |
| `INTERFACE_ID` | String | `IN37-2` |
| `DELAI_DIF_JOURS` | Integer | `58` (RG00 ; peut aussi être lu dans `ZTVARVC`) |
| `LAST_TS` | Long | Lu dans `T_INTERFACE_DELTA` |
| `CURRENT_TS` | Long | Calculé au démarrage, en UTC (`AAAAMMJJhhmmss`) |
| `SEQ_BATCH_ID` | Long | Lu dans `SEQ_BATCH_IN37_2.NEXTVAL` |

## Vue d'ensemble

```
J_IN37_2_RAPPRO_FI
│
├─ tPrejob ──► tDBConnection (HANA)  ──► tOracleConnection (LTRF, auto-commit OFF)
│                                         └─► tOracleInput "INIT_DELTA" ──► tJavaRow "SET_CONTEXT"
│
├─ SubJob 1  FLUX 1 : NON RAPPROCHÉES
│   tDBInput "ACDOCA_NON_RAPPRO" ──main──► tMap "MAP_NON_RAPPRO" ──out──►   tOracleOutput "T_RAPPRO_FI"
│                                           ▲  ▲  ▲                 └rej─► tOracleOutput "T_RAPPRO_FI_REJET"
│   tDBInput "LKP_ZREF_CP" ─────────────────┘  │  │   (RG01)
│   tDBInput "LKP_ZFI_DIF_TRACK" ──────────────┘  │   (RG02)
│   tOracleInput "LKP_TRANSCO" ───────────────────┘   (RG03)
│        │ OnSubjobOk
├─ SubJob 2  FLUX 2 : RAPPROCHÉES
│   tDBInput "ACDOCA_RAPPRO" ──main──► tMap "MAP_RAPPRO" ──out──► tOracleOutput "T_RAPPRO_FI"
│                                       ▲  ▲               └rej─► tOracleOutput "T_RAPPRO_FI_REJET"
│   tDBInput "LKP_ZREF_CP" ─────────────┘  │   (RG01)
│   tOracleInput "LKP_TRANSCO" ────────────┘   (RG03)
│        │ OnSubjobOk
├─ SubJob 3  FLUX 3 : ANNULATIONS
│   tDBInput "ACDOCA_ANNUL" ──main──► tMap "MAP_ANNUL" ──out──► tOracleOutput "T_RAPPRO_FI_ANNUL"
│        │ OnSubjobOk
├─ SubJob 4  CLÔTURE OK
│   tOracleCommit ──► tOracleRow "UPDATE_DELTA" ──► tOracleCommit ──► tOracleRow "LOG_OK"
│
├─ tLogCatcher / tDie ──► tOracleRollback ──► tOracleRow "LOG_KO"   (timestamp NON mis à jour)
│
└─ tPostjob ──► tOracleClose ──► tDBClose
```

Les trois flux et la mise à jour du timestamp se font dans **une seule transaction Oracle**.
Si un flux échoue, tout est annulé et le delta n'avance pas. Le run suivant reprend donc
exactement la même fenêtre de données.

## Détail des composants

### tPrejob

1. **`tDBConnection` (HANA)** : base SAP HANA, avec le driver `ngdbc.jar`.
2. **`tOracleConnection`** : auto-commit désactivé.
3. **`tOracleInput` « INIT_DELTA »** :
   ```sql
   "SELECT d.LAST_SUCCESS_TS, SEQ_BATCH_IN37_2.NEXTVAL AS SEQ_BATCH_ID
      FROM T_INTERFACE_DELTA d
     WHERE d.INTERFACE_ID = '" + context.INTERFACE_ID + "'"
   ```
4. **`tJavaRow` « SET_CONTEXT »** :
   ```java
   context.LAST_TS      = input_row.LAST_SUCCESS_TS.longValue();
   context.CURRENT_TS   = routines.RapproFiUtils.nowSapTimestampUtc();
   context.SEQ_BATCH_ID = input_row.SEQ_BATCH_ID.longValue();
   globalMap.put("D_START", new java.util.Date());
   System.out.println("[IN37-2] Sélection du " + context.LAST_TS + " au " + context.CURRENT_TS);
   ```

### SubJob 1 : pièces non rapprochées

**`tDBInput` « ACDOCA_NON_RAPPRO »** : il utilise la connexion HANA et la requête **FLUX 1** de
`02_extraction_acdoca_hana.sql`. Remplacez les placeholders comme ceci :
```java
"... WHERE A.RCLNT = '" + context.SAP_MANDT + "' ..."
"... AND A.TIMESTAMP >  " + context.LAST_TS + " AND A.TIMESTAMP <= " + context.CURRENT_TS + " ..."
```

Schéma de sortie :

| Colonne | Type Talend |
|---|---|
| RBUKRS | String |
| GJAHR | String |
| BELNR | String |
| BUZEI | String |
| DOCLN | String |
| BLDAT | String |
| BUDAT | String |
| TIMESTAMP | BigDecimal |
| BLART | String |
| RACCT | String |
| PRCTR | String |
| RCNTR | String |
| HSL | BigDecimal |
| SGTXT | String |
| XREF2 | String |
| XREF3 | String |
| AUGBL | String |
| AUGDT | String |

**Lookups du tMap.** Ils sont tous en *Load once*, avec le modèle de correspondance *Unique match*.

| Lookup | Requête | Jointure | Règle |
|---|---|---|---|
| `LKP_ZREF_CP` | `SELECT PRCTR, WERKS FROM ZREF_CP WHERE MANDT = '<mandt>'` | `PRCTR = row.PRCTR`, Left Outer | RG01 |
| `LKP_ZFI_DIF_TRACK` | `SELECT BUKRS, BELNR, GJAHR, BUZEI, DIF_ID, ERDAT FROM ZFI_DIF_TRACK WHERE MANDT = '<mandt>' AND BUKRS IN ('FR01','FR03','FR09','FR10','FR11','FR15','FR16')` | sur BUKRS, BELNR, GJAHR et BUZEI, Left Outer | RG02 |
| `LKP_TRANSCO` | `SELECT TYP_PIECE, TYP_RAPPRO, TYP_FLUX FROM T_TRANSCO_TYP_PIECE` | `TYP_PIECE = row.BLART`, **Inner Join** | RG03 |

Sur `LKP_TRANSCO`, cochez *Catch lookup inner join reject* : une transco manquante part alors
en rejet.

**Sortie `out` du `tMap` « MAP_NON_RAPPRO »** :

| Colonne cible | Expression |
|---|---|
| ID_RAPPRO_FI_AX | `RapproFiUtils.idRapproFiAx(row.RBUKRS, row.GJAHR, row.BELNR)` |
| ID_LIG_COMPTA | `Long.valueOf(row.DOCLN)` |
| N_RAPPRO | `null` |
| D_EVENEMENT | `RapproFiUtils.sapDate(row.BLDAT)` |
| D_INTEGRATION | `RapproFiUtils.sapTimestampToDate(row.TIMESTAMP)` |
| D_COMPTABLE | `RapproFiUtils.sapDate(row.BUDAT)` |
| I_AGENT | `RapproFiUtils.agent(row.BLART, row.XREF3)` |
| I_PV | `zrefcp.WERKS` |
| I_DEPT_ACTIVITE | `row.RACCT` |
| TYP_PIECE | `row.BLART` |
| TYP_RAPPRO | `transco.TYP_RAPPRO` |
| TYP_FLUX | `transco.TYP_FLUX` |
| M_DEBIT | `RapproFiUtils.debit(row.HSL)` |
| M_CREDIT | `RapproFiUtils.credit(row.HSL)` |
| F_RAPPROCHE | `"0"` |
| F_ECART | `"0"` |
| MOTIF_ECART | `null` |
| MOTIF_IMPUTATION | `null` |
| NUM_DIF | `dif.DIF_ID` |
| D_EMISSION | `RapproFiUtils.sapDate(dif.ERDAT)` |
| D_LIM_REP_DIF | `RapproFiUtils.dateLimiteDif(RapproFiUtils.sapDate(row.BUDAT), context.DELAI_DIF_JOURS)` |
| MODE_PAIEMENT | `RapproFiUtils.modePaiement(row.XREF2)` |
| DESCRIPTION | `row.SGTXT` |
| D_ENVOI | `TalendDate.getCurrentDate()` |
| D_TRAITE | `TalendDate.getCurrentDate()` |
| LITIGE_BANCAIRE | `null` |
| IMPUTATION_GERANT | `null` |
| FRAIS_CB | `null` |
| DIFFERENCE_CHANGE | `null` |
| SEQ_BATCH_ID | `context.SEQ_BATCH_ID` |
| D_RAPPROCHEMENT | `null` |

**Sortie `rej` (inner join reject)** : elle écrit dans `T_RAPPRO_FI_REJET`.

| Colonne cible | Expression |
|---|---|
| SEQ_BATCH_ID | `context.SEQ_BATCH_ID` |
| ID_RAPPRO_FI_AX | même expression que pour la sortie `out` |
| ID_LIG_COMPTA | même expression que pour la sortie `out` |
| TYP_PIECE | `row.BLART` |
| ERROR_MESSAGE | `"Transco RG03 absente pour BLART=" + row.BLART` |

**`tOracleOutput` « T_RAPPRO_FI »** :
- il utilise la connexion existante ;
- l'action sur les données est *Insert or update*, avec la clé `ID_RAPPRO_FI_AX`, `ID_LIG_COMPTA`
  et `F_RAPPROCHE` ;
- le *Batch size* est de 5 000, ce qui est confortable pour environ 20 000 lignes par jour.

Grâce à l'*Insert or update*, relancer le job sur une fenêtre déjà traitée ne crée pas de doublon.

### SubJob 2 : pièces rapprochées

**`tDBInput` « ACDOCA_RAPPRO »** : il utilise la requête **FLUX 2**, avec
`${LAST_DATE} = String.valueOf(context.LAST_TS).substring(0, 8)`.

La requête calcule déjà, pour chaque pièce, les colonnes `LITIGE_BANCAIRE`, `IMPUTATION_GERANT`,
`FRAIS_CB`, `DIFFERENCE_CHANGE`, `HAS_IMPUT_GERANT`, `HAS_ECART` et `MOTIF_IMPUTATION`
(règles RG04 à RG07).

**`tMap` « MAP_RAPPRO »** : il utilise les lookups `LKP_ZREF_CP` et `LKP_TRANSCO`. Il n'y a pas de
lookup DIF : il n'y a pas de DIF sur les pièces rapprochées.

Les colonnes absentes du tableau ci-dessous sont **identiques au flux 1**.

| Colonne cible | Expression |
|---|---|
| N_RAPPRO | `row.AUGBL` |
| F_RAPPROCHE | `"1"` |
| F_ECART | `row.HAS_ECART == 1 ? "1" : "0"` |
| MOTIF_ECART | `row.HAS_IMPUT_GERANT == 1 ? "ManagerImputation" : null` |
| MOTIF_IMPUTATION | `row.HAS_IMPUT_GERANT == 1 ? row.MOTIF_IMPUTATION : null` |
| NUM_DIF | `null` |
| D_EMISSION | `null` |
| D_LIM_REP_DIF | `null` |
| LITIGE_BANCAIRE | `row.LITIGE_BANCAIRE` |
| IMPUTATION_GERANT | `row.IMPUTATION_GERANT` |
| FRAIS_CB | `row.FRAIS_CB` |
| DIFFERENCE_CHANGE | `row.DIFFERENCE_CHANGE` |
| D_RAPPROCHEMENT | `RapproFiUtils.sapDate(row.AUGDT)` |

Ce flux écrit dans le **même `tOracleOutput` (*Insert or update*)** que le flux 1. La clé contient
`F_RAPPROCHE` : la cible garde donc à la fois la ligne « non rapprochée » et la ligne « rapprochée »
d'une même pièce. Si LTRF préfère n'avoir qu'une ligne par pièce, retirez `F_RAPPROCHE` de la clé :
la ligne rapprochée écrasera alors la ligne non rapprochée.

### SubJob 3 : annulations

**`tDBInput` « ACDOCA_ANNUL »** : il utilise la requête **FLUX 3**.

**Sortie du `tMap` « MAP_ANNUL »** :

| Colonne cible | Expression |
|---|---|
| ID_RAPPRO_FI_AX | `RapproFiUtils.idRapproFiAx(row.RBUKRS, row.GJAHR, row.BELNR)` |
| ID_LIG_COMPTA | `Long.valueOf(row.DOCLN)` |
| REF_DOC_ORG | `row.AWORG` |
| REF_DOC_NUMBER | `row.AWREF` |
| REF_DOC_ITEM | `row.AWITEM` |
| D_EVENEMENT | `RapproFiUtils.sapDate(row.BLDAT)` |
| D_INTEGRATION | `RapproFiUtils.sapTimestampToDate(row.TIMESTAMP)` |
| D_COMPTABLE | `RapproFiUtils.sapDate(row.BUDAT)` |
| D_ENVOI | `TalendDate.getCurrentDate()` |
| D_TRAITE | `TalendDate.getCurrentDate()` |
| SEQ_BATCH_ID | `context.SEQ_BATCH_ID` |

**`tOracleOutput` « T_RAPPRO_FI_ANNUL »** : *Insert or update*, avec la clé `ID_RAPPRO_FI_AX` et
`ID_LIG_COMPTA`.

Le système cible se sert de `REF_DOC_NUMBER` (la pièce de rapprochement annulée) pour remettre à
« non rapproché » les lignes de `T_RAPPRO_FI` dont `N_RAPPRO = REF_DOC_NUMBER`.

### SubJob 4 : clôture OK (§5 et §7 de la spec)

**1. `tOracleCommit`** (connexion conservée).

**2. `tOracleRow` « UPDATE_DELTA »** :
```java
"UPDATE T_INTERFACE_DELTA SET LAST_SUCCESS_TS = " + context.CURRENT_TS +
" WHERE INTERFACE_ID = '" + context.INTERFACE_ID + "'"
```

**3. `tOracleRow` « LOG_OK »** :
```java
"INSERT INTO T_INTERFACE_LOG (SEQ_BATCH_ID, INTERFACE_ID, TS_FROM, TS_TO, COMPANY_CODES, TS_UPDATED," +
" NB_SELECTED, NB_SUCCESS, NB_ERROR, D_START, D_END, STATUS) VALUES (" +
context.SEQ_BATCH_ID + ", '" + context.INTERFACE_ID + "', " + context.LAST_TS + ", " + context.CURRENT_TS +
", 'FR01,FR03,FR09,FR10,FR11,FR15,FR16', 'OUI', " +
( ((Integer)globalMap.get("tDBInput_1_NB_LINE")) + ((Integer)globalMap.get("tDBInput_4_NB_LINE"))
  + ((Integer)globalMap.get("tDBInput_6_NB_LINE")) ) + ", " +
( ((Integer)globalMap.get("tOracleOutput_1_NB_LINE_INSERTED")) + ((Integer)globalMap.get("tOracleOutput_1_NB_LINE_UPDATED"))
  + ((Integer)globalMap.get("tOracleOutput_3_NB_LINE_INSERTED")) + ((Integer)globalMap.get("tOracleOutput_3_NB_LINE_UPDATED")) ) + ", " +
((Integer)globalMap.get("tOracleOutput_2_NB_LINE_INSERTED")) + ", " +
"TO_DATE('" + TalendDate.formatDate("yyyy-MM-dd HH:mm:ss", (java.util.Date)globalMap.get("D_START")) + "','YYYY-MM-DD HH24:MI:SS'), SYSDATE, 'OK')"
```
Adaptez les suffixes `_1`, `_4`, etc. aux noms réels des composants dans votre job.

**4. `tOracleCommit`** (connexion fermée).

### Gestion d'erreur

En cas d'erreur, le job passe par `tLogCatcher` (avec *Catch Java Exception* et *Catch tDie*).
L'enchaînement est le suivant :

1. **`tOracleRollback`** : annule toutes les écritures du run.
2. **`tOracleRow` « LOG_KO »** : écrit le journal d'échec avec `STATUS = 'KO'`, `TS_UPDATED = 'NON'`
   et `MESSAGE = <message>`.
3. **`tOracleCommit`** : enregistre ce journal.
4. **`tDie`** : renvoie un code retour 1 à l'ordonnanceur.

### tPostjob

`tOracleClose` puis `tDBClose`.

## Ordonnancement

- Le job tourne **une fois par jour**, par exemple via la TMC ou un ordonnanceur (Control-M, cron)
  qui lance le script `.sh` exporté.
- La fenêtre de données est `]LAST_TS ; CURRENT_TS]`, calculée en UTC comme `ACDOCA.TIMESTAMP`.
- Pour une première exécution ou une reprise, initialisez `T_INTERFACE_DELTA.LAST_SUCCESS_TS` à la date
  voulue.

## Recette (environnement D01)

1. Exécutez le job sur une ou plusieurs journées.
2. Comparez le nombre de lignes de `T_RAPPRO_FI` avec une requête SE16H sur `ACDOCA`, avec les mêmes filtres.
3. Vérifiez sur quelques pièces :
   - la clé `ID_RAPPRO_FI_AX` ;
   - le débit et le crédit ;
   - le PDV (RG01) ;
   - la DIF (RG02) ;
   - les écarts RG04 à RG07.
4. Testez les trois scénarios d'annulation (jeux de données de K. TALLA) :
   - rapprochement → annulation ;
   - rapprochement → annulation → re-rapprochement avec la même pièce ;
   - rapprochement → annulation → re-rapprochement avec une autre pièce.
5. Relancez le job sans nouvelle donnée : il ne doit faire aucune insertion et le timestamp doit être mis à jour.
6. Forcez une erreur, par exemple en supprimant une transco : vérifiez le rollback, le statut KO et le delta inchangé.

## Hypothèses à valider avec LTRF et SAP

- `XREF2` et `XREF3` sont lus dans `BSEG`, car ils ne sont pas dans `ACDOCA`. On ne lit que le
  ledger `0L` d'`ACDOCA`.
- Les types de pièces retenus sont **YJ et FF**, comme dans les critères de sélection. RG03 cite
  XX et FI : la table de transco se met à jour sans toucher au job.
- `ID_RAPPRO_FI_AX` est stocké en `VARCHAR2(30)` et non en `NUMBER`, à cause des tirets.
- `M_CREDIT` est stocké en valeur absolue. Si LTRF préfère le montant négatif, il suffit d'adapter
  `RapproFiUtils.credit`.
- Le délai DIF vaut 58 jours, porté par la variable de contexte `DELAI_DIF_JOURS`.
- Les FF non rapprochées suivent un delta sur `TIMESTAMP`, car la date de rapprochement n'a pas de
  sens quand `AUGBL` est vide.
- Le flux 2 suit un delta sur `AUGDT` à la journée. Il peut donc renvoyer des lignes déjà envoyées,
  mais l'*Insert or update* évite les doublons.
