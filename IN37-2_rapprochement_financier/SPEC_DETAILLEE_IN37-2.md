# Spécification détaillée – IN37-2 Rapprochement financier (Talend)

| | |
|---|---|
| **Jira** | IT-19934 (lié à IT-18556 – FI28-1 Rapprochement des flux financiers) |
| **ID gap** | IN37-2 |
| **Document source** | `PULSE_XBL FR IT-IT-19934 - IN37-2 Rapprochement financier.pdf` (DI V1.0 du 10/06/2026) |
| **Interface** | « Blake & Mortimer » : SAP S/4HANA → BDD intermédiaire LTRF |
| **Développement** | Talend : job `J_IN37_2_RAPPRO_FI` |
| **Rédacteur** | Hamdou DEME |
| **Version** | V0.1 (brouillon, en attente des réponses aux questions ouvertes, voir §14) |

Documents associés :
- `RESUME_IN37-2.md` : résumé de la DI
- `JOB_TALEND_IN37-2.md` : conception composant par composant
- `sql/01_ddl_bdd_intermediaire_oracle.sql` : modèle cible
- `sql/02_extraction_acdoca_hana.sql` : requêtes d'extraction
- `routines/RapproFiUtils.java` : routine Talend

> Convention : **[Qn]** renvoie à une question ouverte du §14. Tant qu'une question n'a pas de
> réponse, c'est l'**hypothèse** indiquée qui est développée.

---

## 1. Contexte et objectifs

LTRF doit suivre le rapprochement des flux financiers des points de vente (PDV) :
- **versement ↔ virement** : la recette boutique déposée doit correspondre au virement bancaire reçu ;
- **prélèvement ↔ pièces justificatives**.

Les écritures comptables et les rapprochements sont faits dans SAP S/4HANA. L'interface doit
envoyer à la BDD intermédiaire LTRF :
1. les pièces **non rapprochées** ;
2. les pièces **rapprochées**, avec le détail des écarts ;
3. les **annulations** de rapprochement.

L'envoi a lieu **une fois par jour, en mode delta**. Le volume attendu est d'environ
**20 000 lignes par jour**.

## 2. Périmètre

### 2.1 Dans le périmètre

| Élément | Valeurs |
|---|---|
| Sociétés | Set `ZFI_LTRF_BUKRS` : FR01, FR03, FR09, FR10, FR11, FR15, FR16 (FR03 et FR11 n'ont pas de PDV) |
| Types de pièces | RB (versement), ZR (virement), YJ (prélèvement) [Q1], FF (pièce justificative) [Q1], RG (annulation de rapprochement) |
| Comptes | Set `ZFI_LTRF_RAPPRO_FI_RACCT` (RB, ZR, YJ) |
| Fournisseur | Variable TVARVC `ZFI_LTRF_FF_LIFNR` (FF uniquement) |
| Organisation | PDV LTRF uniquement (sites de catégorie `VLFKZ = 'A'`) |

### 2.2 Hors périmètre

- Les autres types de pièces, notamment EC [Q2].
- La correspondance des types de pièces RG03 ; à confirmer [Q20].
- Le traitement fonctionnel côté LTRF : rapprochement, DIF, restitution.
- La gestion des autorisations SAP (non renseignée dans la DI).

## 3. Architecture

```
 SAP S/4HANA (HANA DB)                Talend (TMC / JobServer)               BDD intermédiaire LTRF (Oracle)
┌─────────────────────┐   JDBC     ┌──────────────────────────┐   JDBC    ┌───────────────────────────┐
│ ACDOCA, BSEG        │──────────► │  J_IN37_2_RAPPRO_FI      │─────────► │ T_RAPPRO_FI               │
│ SETLEAF, TVARVC     │  lecture   │   Flux 1 non rapprochées │           │ T_RAPPRO_FI_ANNUL         │
│ T001K, T001W        │  seule     │   Flux 2 rapprochées     │           │ T_RAPPRO_FI_REJET         │
│ ZREF_CP, CSKS       │            │   Flux 3 annulations     │           │ T_TRANSCO_TYP_PIECE       │
│ ZFI_DIF_TRACK       │            │   Delta + journal        │           │ T_INTERFACE_DELTA / _LOG  │
└─────────────────────┘            └──────────────────────────┘           └───────────────────────────┘
```

- **Hypothèse** : Talend a un accès JDBC en lecture à HANA [Q24].
  - **Alternative 1** : utiliser `tSAPTableInput` (RFC).
  - **Alternative 2** : SAP PO dépose un fichier, que Talend intègre (dans ce cas, le flux SAP PO prévu dans la DI est conservé).
- Les trois flux et la mise à jour du delta forment **une seule transaction Oracle** : un run est soit totalement appliqué, soit totalement annulé.

## 4. Sources SAP

| Table | Usage | Champs utilisés |
|---|---|---|
| `ACDOCA` | Journal universel (source principale) | RCLNT, RLDNR, RBUKRS, GJAHR, BELNR, BUZEI, DOCLN, BLART, BLDAT, BUDAT, TIMESTAMP, RACCT, PRCTR, RCNTR, LIFNR, HSL, SGTXT, AUGBL, AUGDT, XREVERSING, AWORG, AWREF, AWITEM |
| `BSEG` | Références de poste, absentes d'ACDOCA [Q12] | XREF2, XREF3 |
| `SETLEAF` | Contenu des sets FI | SETNAME, VALOPTION, VALFROM, VALTO |
| `TVARVC` | Fournisseur des FF | NAME = `ZFI_LTRF_FF_LIFNR`, LOW |
| `ZTVARVC` | Délai DIF (RG00) [Q5] | PEROP_END_ADD_DAYS ? |
| `T001K` | Société → domaine de valorisation | BUKRS, BWKEY |
| `T001W` | Domaine → site PDV | BWKEY, WERKS, VLFKZ |
| `ZREF_CP` | PDV ↔ centre de profit (RG01) | WERKS, PRCTR |
| `CSKS` | Centre de profit → centre de coûts | PRCTR, KOSTL, DATBI |
| `ZFI_DIF_TRACK` | DIF (RG02) | BUKRS, BELNR, GJAHR, BUZEI, DIF_ID, ERDAT |

Règles techniques de lecture :
- On ne lit que le ledger principal : `RLDNR = '0L'` [Q13].
- Les comptes sont comparés sans les zéros de tête : `LTRIM(RACCT,'0')`.
- Les sets sont lus en tenant compte des intervalles (`VALOPTION = 'BT'`) [Q14].

## 5. Constitution du périmètre LTRF

Le périmètre se construit en 6 étapes :

1. **Sociétés** : on lit le contenu du set `ZFI_LTRF_BUKRS`. C'est l'équivalent de `G_SET_GET_ID_FROM_NAME` et `G_SET_TREE_IMPORT` côté ABAP.
2. **Domaines de valorisation** : on lit `T001K.BWKEY` pour ces sociétés.
3. **PDV** : on lit `T001W.WERKS` pour ces domaines, avec `VLFKZ = 'A'`.
4. **Centres de profit** : on lit `ZREF_CP.PRCTR` pour ces PDV.
5. **Centres de coûts** : on lit `CSKS.KOSTL` pour ces centres de profit, en ne gardant que ceux encore valides (`DATBI >= aujourd'hui`).
6. **Comptes et fournisseur** : on lit le set `ZFI_LTRF_RAPPRO_FI_RACCT` et la variable TVARVC `ZFI_LTRF_FF_LIFNR`.

Ce périmètre est recalculé à chaque run. Aucune liste n'est figée dans le job.

## 6. Flux 1 : pièces non rapprochées

### 6.1 Sélection

Critères communs :
- `RBUKRS` est dans le set `ZFI_LTRF_BUKRS` ;
- `AUGBL` est vide ;
- `LAST_TS < TIMESTAMP ≤ CURRENT_TS`.

Critères selon le type de pièce :

| Types de pièces | Critères supplémentaires |
|---|---|
| ZR, RB, YJ | `PRCTR` est un centre de profit LTRF **et** `RACCT` est dans le set `ZFI_LTRF_RAPPRO_FI_RACCT` |
| FF | `RCNTR` est un centre de coûts LTRF **et** `LIFNR` = `ZFI_LTRF_FF_LIFNR` |

Pour les FF, la DI parle de « date de rapprochement > timestamp ». Ce n'est pas cohérent quand
`AUGBL` est vide. **Hypothèse** : on filtre sur `TIMESTAMP` [Q15].

### 6.2 Mapping vers `T_RAPPRO_FI`

| # | Colonne cible | Nouveau nommage | Type | Source / règle | Remarque |
|---|---|---|---|---|---|
| 1 | ID_RAPPRO_FI_AX | DocumentNumber | VARCHAR2(30) [Q21] | `RBUKRS-GJAHR-BELNR` | Clé |
| 2 | ID_LIG_COMPTA | LineDocumentNumber | NUMBER | DOCLN | Clé |
| 3 | N_RAPPRO | (supprimé) | VARCHAR2(11) | à blanc | |
| 4 | D_EVENEMENT | DocumentDate | DATE | BLDAT | |
| 5 | D_INTEGRATION | Timestamp | DATE | TIMESTAMP | Conversion depuis `AAAAMMJJhhmmss` |
| 6 | D_COMPTABLE | PostingDate | DATE | BUDAT | |
| 7 | I_AGENT | Agent | VARCHAR2(6) | XREF3 | Seulement pour RB (et EC [Q2]) |
| 8 | I_PV | PlantPOS | CHAR(6) | RG01 | |
| 9 | I_DEPT_ACTIVITE | GLAccount | VARCHAR2(30) | RACCT | |
| 10 | TYP_PIECE | DocumentType | CHAR(2) | BLART | |
| 11 | TYP_RAPPRO | ReconciliationType | VARCHAR2(40) | RG03 [Q20] | VE_VI / PR_JU |
| 12 | TYP_FLUX | FlowType | VARCHAR2(40) | RG03 [Q20] | VE / VI / PR / JU |
| 13 | M_DEBIT | DebitAmount | NUMBER | HSL si HSL > 0 | |
| 14 | M_CREDIT | CreditAmount | NUMBER | \|HSL\| si HSL < 0 | Signe à confirmer [Q4] |
| 15 | F_RAPPROCHE | ReconciIndicator | VARCHAR2(1) | `'0'` | |
| 16 | F_ECART | DiffIndicator | VARCHAR2(1) | `'0'` | |
| 17 | MOTIF_ECART | DiffReason | VARCHAR2(40) | vide | |
| 18 | MOTIF_IMPUTATION | AllocReason | VARCHAR2(40) | vide | |
| 19 | NUM_DIF | DIFNumber | VARCHAR2(45) | RG02 → DIF_ID | |
| 20 | D_EMISSION | IssueDate | DATE | RG02 → ERDAT | |
| 21 | D_LIM_REP_DIF | DueDate | DATE | BUDAT + délai (RG00) | Délai à confirmer [Q5] |
| 22 | MODE_PAIEMENT | PaymentMethod | VARCHAR2(10) | XREF2, caractères 5 à 7 | Pièces RB |
| 23 | DESCRIPTION | DocumentItemText | VARCHAR2(60) | SGTXT | |
| 24 | D_ENVOI | SendingDate | DATE | date du run | Prévu « par SAP PO » dans la DI [Q23] |
| 25 | D_TRAITE | ProcessingDate | DATE | date du run | Idem [Q23] |
| 26 | LITIGE_BANCAIRE | BankDisputeAmount | NUMBER | à blanc | |
| 27 | IMPUTATION_GERANT | MngrAllocAmount | NUMBER | à blanc | |
| 28 | FRAIS_CB | CardFeeAmount | NUMBER | à blanc | |
| 29 | DIFFERENCE_CHANGE | ExchRateDiffAmount | NUMBER | à blanc | |
| 30 | SEQ_BATCH_ID | BatchSequenceId | NUMBER(19) | séquence Oracle | Un numéro par run |
| 31 | D_RAPPROCHEMENT | ReconcilDate | DATE | à blanc | |

Le champ COMMENTAIRE a été supprimé : c'était un doublon de SGTXT.

## 7. Flux 2 : pièces rapprochées

### 7.1 Sélection

Les critères sont ceux du §6.1, avec trois différences :
- `AUGBL` **n'est pas** vide ;
- le delta porte sur la **date de rapprochement** : `AUGDT ≥ date(LAST_TS)` [Q17] ;
- pour ZR, RB et YJ, la DI filtre ici sur le **centre de coûts**, alors que le flux 1 filtre sur le
  **centre de profit** [Q16].

**Hypothèse** : la sélection suit la DI à la lettre (centre de coûts).

### 7.2 Mapping (seules les différences avec le §6.2 sont listées)

| Colonne cible | Source / règle |
|---|---|
| N_RAPPRO | AUGBL |
| F_RAPPROCHE | `'1'` |
| F_ECART | `'1'` si la pièce porte au moins une ligne sur un compte d'écart (RG04 à RG07), sinon `'0'` [Q6] |
| MOTIF_ECART | `'ManagerImputation'` si la pièce porte une ligne sur 65171000 (RG05), sinon vide [Q7] |
| MOTIF_IMPUTATION | SGTXT de la 1re ligne (plus petit DOCLN) sur 65171000 (RG05) [Q8] |
| NUM_DIF, D_EMISSION, D_LIM_REP_DIF | à blanc (pas de DIF sur les pièces rapprochées) |
| LITIGE_BANCAIRE | RG04 |
| IMPUTATION_GERANT | RG05 |
| FRAIS_CB | RG06 |
| DIFFERENCE_CHANGE | RG07 |
| D_RAPPROCHEMENT | AUGDT |

### 7.3 Une ou deux lignes par pièce ?

Une pièce envoyée d'abord comme non rapprochée, puis comme rapprochée, peut donner :
- **Option A (développée)** : 2 lignes, car la clé contient `F_RAPPROCHE`. On garde l'historique.
- **Option B** : 1 ligne, mise à jour au moment du rapprochement.

Le choix dépend de LTRF [Q9].

## 8. Flux 3 : annulations de rapprochement

### 8.1 Principe

Quand un rapprochement est annulé, SAP crée une pièce de contrepassation, de type RG comme le
rapprochement d'origine. Il remet aussi `AUGBL` à blanc sur les pièces d'origine. On ne peut donc
envoyer que la pièce d'annulation, avec sa référence vers le rapprochement annulé. C'est LTRF qui
reconstitue le statut des pièces.

### 8.2 Sélection

| Critère | Valeur |
|---|---|
| Société (RBUKRS) | dans `ZFI_LTRF_BUKRS` |
| Centre de coûts (RCNTR) | centre de coûts LTRF [Q16] |
| Type de pièce (BLART) | `'RG'` |
| Indicateur de contrepassation (XREVERSING) | `'X'` [Q18] |
| Delta | `LAST_TS < TIMESTAMP ≤ CURRENT_TS` |

### 8.3 Mapping vers `T_RAPPRO_FI_ANNUL`

| Colonne cible [Q22] | Nouveau nommage | Source |
|---|---|---|
| ID_RAPPRO_FI_AX | DocumentNumber | `RBUKRS-GJAHR-BELNR` |
| ID_LIG_COMPTA | LineDocumentNumber | DOCLN |
| REF_DOC_ORG | RefDocOrg | AWORG (société + exercice) |
| REF_DOC_NUMBER | RefDocNumber | AWREF (pièce de rapprochement annulée) |
| REF_DOC_ITEM | RefDocItem | AWITEM |
| D_EVENEMENT | DocumentDate | BLDAT |
| D_INTEGRATION | Timestamp | TIMESTAMP |
| D_COMPTABLE | PostingDate | BUDAT |
| D_ENVOI | SendingDate | date du run |
| D_TRAITE | ProcessingDate | date du run |
| SEQ_BATCH_ID | BatchSequenceId | séquence Oracle |

## 9. Règles de gestion

| Règle | Description | Implémentation Talend |
|---|---|---|
| **RG00** | Date limite de réponse DIF = BUDAT + délai | `RapproFiUtils.dateLimiteDif(budat, context.DELAI_DIF_JOURS)`, avec un délai de 58 jours par défaut [Q5] |
| **RG01** | Code PDV : `ZREF_CP` avec PRCTR = ACDOCA.PRCTR, on récupère WERKS | Lookup dans le `tMap`, chargé une fois (*Load once*), jointure externe (*Left Outer*). Si plusieurs PDV ont le même centre de profit, voir [Q10] |
| **RG02** | DIF : `ZFI_DIF_TRACK` avec BUKRS, BELNR, GJAHR, BUZEI, on récupère DIF_ID et ERDAT | Lookup dans le `tMap`, jointure externe (*Left Outer*) |
| **RG03** | Correspondance du type de pièce (BLART) vers le type de rapprochement et le type de flux | Table `T_TRANSCO_TYP_PIECE`. Une correspondance absente part en rejet [Q20] |
| **RG04** | Litige bancaire = ABS(SUM(HSL)) des lignes de la pièce sur 51100003, sinon 0 | Calcul SQL dans la requête du flux 2 [Q11] |
| **RG05** | Imputation gérant : même règle sur 65171000, plus le motif d'écart et le motif d'imputation | Calcul SQL dans la requête du flux 2 |
| **RG06** | Frais CB : même règle sur 62780002 | Calcul SQL dans la requête du flux 2 |
| **RG07** | Différence de change : même règle sur 75601000 | Calcul SQL dans la requête du flux 2 |

Correspondance RG03 développée :

| BLART | Type de rapprochement | Type de flux |
|---|---|---|
| RB | VE_VI | VE |
| ZR | VE_VI | VI |
| YJ (XX dans la DI) [Q1] | PR_JU | PR |
| FF (FI dans la DI) [Q1] | PR_JU | JU |

## 10. Gestion du delta et de la transaction

- **Fenêtre traitée** : `]LAST_TS ; CURRENT_TS]`, au format SAP `AAAAMMJJhhmmss`, en UTC [Q19].
  - `LAST_TS` est lu dans `T_INTERFACE_DELTA`.
  - `CURRENT_TS` est figé au démarrage du run.
- **Fin normale** : on valide les écritures, on enregistre `LAST_SUCCESS_TS = CURRENT_TS`, on valide à nouveau, puis on écrit le journal en statut OK.
- **Échec** : rollback complet. Le delta n'avance pas et le journal est écrit en statut KO.
- **Relance** : l'écriture se fait en *Insert or update*. Relancer le job ne crée pas de doublon.
- **Reprise sur une période donnée** : mettre à jour `T_INTERFACE_DELTA.LAST_SUCCESS_TS` à la main, puis relancer [Q27].

## 11. Gestion des erreurs

| Cas | Comportement |
|---|---|
| Champ source vide | Mappé à blanc (règle de la DI) |
| PDV non trouvé (RG01) | Ligne chargée avec `I_PV` vide [Q10] |
| DIF non trouvée (RG02) | Ligne chargée avec `NUM_DIF` et `D_EMISSION` vides |
| Correspondance RG03 absente | Ligne écrite dans `T_RAPPRO_FI_REJET`, et non chargée [Q25] |
| Erreur technique (connexion, SQL, contrainte) | Rollback, journal KO, code retour 1 et alerte à l'ordonnanceur [Q26] |

## 12. Journal d'exécution (`T_INTERFACE_LOG`)

| Information demandée par la DI | Colonne |
|---|---|
| Sélection du xxx au yyy | TS_FROM, TS_TO |
| Sociétés sélectionnées | COMPANY_CODES |
| Timestamp mis à jour (oui/non) | TS_UPDATED |
| Nombre de lignes sélectionnées | NB_SELECTED |
| Nombre de lignes traitées avec succès | NB_SUCCESS |
| Nombre de lignes en erreur | NB_ERROR |
| Informations complémentaires | SEQ_BATCH_ID, D_START, D_END, STATUS, MESSAGE |

## 13. Plan de tests

| # | Cas | Données | Résultat attendu |
|---|---|---|---|
| T01 | Versement RB non rapproché | 1 RB en FR01 sur un compte du set | 1 ligne avec `F_RAPPROCHE = 0`, I_PV, MODE_PAIEMENT et I_AGENT renseignés |
| T02 | Virement ZR non rapproché avec DIF | ZR présent dans `ZFI_DIF_TRACK` | NUM_DIF et D_EMISSION renseignés, D_LIM_REP_DIF = BUDAT + délai |
| T03 | Prélèvement YJ et FF | YJ, plus une FF du fournisseur TVARVC | 2 lignes, avec TYP_FLUX PR et JU |
| T04 | Pièce hors périmètre | Société hors set, compte hors set, autre fournisseur, site non PDV | Aucune ligne |
| T05 | Rapprochement sans écart | RB et ZR compensés | Lignes avec `F_RAPPROCHE = 1`, `F_ECART = 0`, N_RAPPRO = AUGBL |
| T06 | Rapprochement avec écarts | Lignes sur 51100003, 65171000, 62780002 et 75601000 | Montants RG04 à RG07 en valeur absolue, motif ManagerImputation et SGTXT |
| T07 | Virement → rapprochement → annulation | Jeu de K. TALLA n°1 | 1 ligne dans `T_RAPPRO_FI_ANNUL`, REF_DOC_NUMBER = pièce de rapprochement |
| T08 | … → re-rapprochement avec la même pièce | Jeu de K. TALLA n°2 | Annulation, puis nouvelle ligne rapprochée |
| T09 | … → re-rapprochement avec une autre pièce | Jeu de K. TALLA n°3 | Idem, avec un AUGBL différent |
| T10 | Delta | 2 runs successifs sans nouvelle donnée | 2e run : 0 ligne, timestamp avancé |
| T11 | Relance sur la même fenêtre | Remettre LAST_TS en arrière, puis relancer | Pas de doublon (mises à jour seulement) |
| T12 | Rejet de correspondance | Supprimer la ligne RB de la table de correspondance | Lignes RB en rejet, NB_ERROR > 0 |
| T13 | Erreur technique | Couper la connexion Oracle en cours de run | Rollback, journal KO, delta inchangé |
| T14 | Volumétrie | Une journée de clôture en D01 | Volume ≥ 20 000 lignes, durée acceptable [Q28] |
| T15 | Contrôle croisé SAP | Requête SE16H sur ACDOCA avec les mêmes filtres | Même nombre de lignes et mêmes montants |

## 14. Questions ouvertes

**Statuts :** 🔴 bloquant pour le développement · 🟠 impacte le mapping ou les tests · 🟢 peut attendre la recette.

**Interlocuteurs :** FF = F. Fixot (LTR) · NM = N. Manganas (LTRF) · SB = S. Berger (DXC, SAP) ·
MG = M. Guzzardi (LTRF intégration) · KT = K. TALLA · PO = équipe SAP PO.

### 14.1 Fonctionnel

| ID | Statut | Question | Impact | Pour | Hypothèse retenue | Réponse |
|---|---|---|---|---|---|---|
| Q1 | 🔴 | Quel est le code du prélèvement : **YJ** ou **XX** ? Celui des pièces justificatives : **FF** ou **FI** ? La sélection (§1 et §2 de la DI) et RG03 se contredisent. | Sélection et correspondance | FF | YJ et FF | |
| Q2 | 🟠 | `I_AGENT` doit être « alimenté pour RB et EC » : qu'est-ce que le type **EC** ? Doit-il être extrait ? | Périmètre et I_AGENT | FF | EC hors sélection, géré dans I_AGENT | |
| Q3 | 🟢 | D'autres types de pièces sont-ils attendus (avoirs, remboursements, extournes RB/ZR) ? | Périmètre | FF / NM | Non | |
| Q4 | 🟠 | `M_CREDIT` doit-il être envoyé en **valeur absolue** ou en **montant négatif** ? | Montants | NM | Valeur absolue | |
| Q5 | 🔴 | Quel délai pour la date limite DIF : **58 jours** (mapping) ou la variable `ZTVARVC PEROP_END_ADD_DAYS` = 1 (RG00) ? Jours calendaires ou ouvrés ? Le délai doit-il être lu dans SAP ou paramétré dans Talend ? | D_LIM_REP_DIF | FF / SB | 58 jours calendaires, en variable de contexte | |
| Q6 | 🟠 | `F_ECART = 1` dès qu'une ligne d'écart existe, même pour un montant nul ? Ou seulement si la somme est différente de 0 ? | F_ECART | NM | Dès qu'une ligne existe | |
| Q7 | 🟠 | Quel `MOTIF_ECART` si la pièce a plusieurs types d'écart (litige + frais CB…) ? Y a-t-il des motifs pour RG04, RG06 et RG07 ? | MOTIF_ECART | NM | Seul ManagerImputation est renseigné | |
| Q8 | 🟢 | RG05 : la « 1re ligne » est-elle bien celle du plus petit DOCLN ? | MOTIF_IMPUTATION | SB | Plus petit DOCLN | |
| Q9 | 🔴 | Quand une pièce est rapprochée, LTRF veut-il **2 lignes** (non rapprochée + rapprochée) ou **1 ligne mise à jour** ? | Clé cible | NM / MG | 2 lignes (clé avec F_RAPPROCHE) | |
| Q10 | 🟠 | RG01 : un centre de profit peut-il correspondre à plusieurs PDV dans `ZREF_CP` ? Que faire si aucun PDV n'est trouvé ? | I_PV | SB | 1 pour 1. Si non trouvé, I_PV vide | |
| Q11 | 🔴 | RG04 à RG07 : les lignes d'écart sont-elles sur **la pièce traitée** ou sur **la pièce de compensation (AUGBL)** ? Dans SAP, elles sont souvent sur la pièce de compensation. | Montants d'écart | SB / FF | Sur la pièce traitée (lecture littérale de la DI) | |

### 14.2 Technique SAP

| ID | Statut | Question | Impact | Pour | Hypothèse retenue | Réponse |
|---|---|---|---|---|---|---|
| Q12 | 🟠 | `XREF2` et `XREF3` sont-ils disponibles dans ACDOCA, ou faut-il les lire dans BSEG ? | Jointure | SB | Lus dans BSEG | |
| Q13 | 🟠 | Faut-il lire uniquement le ledger **0L** ? | Doublons | SB | 0L | |
| Q14 | 🟢 | Les sets `ZFI_LTRF_BUKRS` et `ZFI_LTRF_RAPPRO_FI_RACCT` contiennent-ils des intervalles ? | Requête | SB | Intervalles gérés | |
| Q15 | 🟠 | FF non rapprochées : le delta porte-t-il sur `TIMESTAMP` ? (La DI dit « date de rapprochement » alors que AUGBL est vide.) | Sélection | SB | TIMESTAMP | |
| Q16 | 🔴 | Flux 1 : filtre sur le **centre de profit**. Flux 2 et 3 : filtre sur le **centre de coûts**. Est-ce voulu ? Les lignes bancaires n'ont souvent pas de centre de coûts. | Volume sélectionné | SB / FF | Lecture littérale de la DI | |
| Q17 | 🟠 | Delta du flux 2 sur `AUGDT`, une date sans heure : faut-il un autre champ horodaté (par exemple le TIMESTAMP de la pièce de compensation) ? | Doublons ou oublis | SB | AUGDT ≥ date de LAST_TS, avec *Insert or update* | |
| Q18 | 🟠 | Annulations : `XREVERSING = 'X'` suffit-il, ou faut-il aussi le code transaction (FBRA) ou le lien de contrepassation ? | Flux 3 | SB | XREVERSING seul | |
| Q19 | 🟢 | `ACDOCA.TIMESTAMP` est-il en UTC ? | Fenêtre de delta | SB | UTC | |
| Q24 | 🔴 | Talend aura-t-il un **accès JDBC à HANA** (compte technique, droits en lecture) ? Sinon : RFC, ou fichier ou appel depuis SAP PO ? | Architecture, plus 2 à 3 j de charge | SB / PO | JDBC HANA | |

### 14.3 Cible LTRF et intégration

| ID | Statut | Question | Impact | Pour | Hypothèse retenue | Réponse |
|---|---|---|---|---|---|---|
| Q20 | 🔴 | La correspondance RG03 est-elle faite **par Talend** ou **par LTRF** à l'intégration ? | TYP_RAPPRO et TYP_FLUX | MG | Talend (table T_TRANSCO_TYP_PIECE) | |
| Q21 | 🔴 | `ID_RAPPRO_FI_AX` est typé NUMBER alors que sa valeur est `FR01-2026-0100000123` : peut-on passer en VARCHAR2(30) ? | Modèle cible | MG | VARCHAR2(30) | |
| Q22 | 🔴 | Quels sont les noms réels des tables et des colonnes cibles ? Ancien ou nouveau nommage ? Colonnes de RefDocOrg, RefDocNumber et RefDocItem (« à confirmer » dans la DI) ? | DDL | MG | Noms provisoires (§6 à §8) | |
| Q23 | 🟠 | Qui alimente `D_ENVOI`, `D_TRAITE` et `SEQ_BATCH_ID` si SAP PO n'est pas dans la chaîne ? | Champs techniques | MG / PO | Talend | |
| Q25 | 🟠 | Que faire d'une erreur de correspondance : rejet, alerte ou blocage du run ? (C'est l'exemple cité au §6 de la DI.) | Gestion d'erreurs | MG | Rejet tracé, run OK | |
| Q26 | 🟢 | Qui est alerté en cas d'échec, et par quel canal (mail, ticket) ? | Exploitation | MG | Alerte de l'ordonnanceur | |

### 14.4 Exploitation et recette

| ID | Statut | Question | Impact | Pour | Hypothèse retenue | Réponse |
|---|---|---|---|---|---|---|
| Q27 | 🟠 | À quelle date commence la **première exécution** (reprise d'historique) ? Comment faire une reprise sur une période donnée ? | Initialisation | NM | Réglage manuel de LAST_SUCCESS_TS | |
| Q28 | 🟢 | Quel horaire et quelles dépendances pour le run quotidien ? Quelle durée maximale ? Quel volume en fin de mois ? | Ordonnancement | MG | Nuit, après les traitements SAP | |
| Q29 | 🟠 | Quand les **jeux de données de test** (open issues de la DI) seront-ils disponibles en D01 ? | Planning de recette | KT | – | |
| Q30 | 🟢 | Qui valide la recette côté métier, et sur quels environnements (D01, Q01) ? | Planning | NM | D01 puis Q01 | |

**Questions bloquantes (🔴) à traiter en priorité :** Q1, Q5, Q9, Q11, Q16, Q20, Q21, Q22, Q24.

## 15. Charge estimée

| Tâche | Jours |
|---|---|
| Analyse, ateliers, réponses aux questions | 1 |
| Mise en place : connexions, contextes, DDL, routine | 1 |
| Flux 1 | 1,5 |
| Flux 2 | 1,5 |
| Flux 3 | 0,5 |
| Delta, transaction, journal, erreurs | 1 |
| Tests unitaires D01 | 1,5 |
| Accompagnement de la recette et corrections | 1,5 |
| Livraison et documentation d'exploitation | 0,5 |
| **Total** | **10 j (fourchette 8 à 12 j)** |

**Réserves :**
- plus 2 à 3 j si l'accès JDBC à HANA n'est pas possible [Q24] ;
- plus 1 à 2 j si les réponses à Q9, Q11 ou Q16 modifient les règles.

## 16. Historique

| Version | Date | Auteur | Commentaire |
|---|---|---|---|
| V0.1 | 20/10/2026 | H. DEME | Création à partir de la DI V1.0, avec 30 questions ouvertes |
