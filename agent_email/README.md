# GetAgentEmail en Talend

Reprise en Talend du script PowerShell `GetAgentEmail.ps1` : pour chaque **gérant en poste** du référentiel PDV EBX (`ref_pdv`, SQL Server), on cherche le compte Active Directory correspondant, puis on écrit le résultat dans `GerantCompletedByAd.csv`.

**Le job ne passe plus par Oracle** : ni lecture de `REFERENTIEL.AGENT`, ni mise à jour.

## Fichiers

| Fichier | Rôle |
|---|---|
| `AGENT_EMAIL_AD_0.1.zip` | Job Talend `AGENT_EMAIL_AD` à importer (*Job Designs* → *Importer des éléments*) |
| `src/build_talend_zip.py` | Régénère le zip : `python3 src/build_talend_zip.py .` |

⚠️ Ce zip est généré par script, pas par Talend Studio. Certaines versions du Studio refusent ce type d'archive (« élément invalide »). Dans ce cas, monte le job à la main avec le guide ci-dessous : il décrit exactement la même configuration.

Après l'import, renseigne les variables de contexte : connexion SQL Server (base EBX), mot de passe AD, compte de service AD, dossier de sortie. Pour tester sur quelques gérants, ajoute `+ " AND g.gerant_ IN ('00241653', '00880022') "` à la fin de la requête du `tMSSqlInput_1`.

## Ce que fait le script (logique à reproduire)

1. Le job lit les gérants en poste dans `ref_pdv` (le script lisait les agents Oracle) :
   ```sql
   SELECT DISTINCT
          CAST(g.gerant_ AS VARCHAR(20))                       AS I_AGENT,
          CAST(p.fichePrincipale_steRattachFk_ AS VARCHAR(20)) AS I_SOCIETE
     FROM EBX_TR_PDV_GERANT_REF_PDV g
    INNER JOIN EBX_TE_PDV_REF_PDV p ON p.fichePrincipale_code = g.pdv_
    WHERE g.gerant_ IS NOT NULL
      AND g.dateDebut <= CAST(GETDATE() AS DATE)
      AND ISNULL(g.dateFin, '9999-12-31') >= CAST(GETDATE() AS DATE)
      AND p.fichePrincipale_statut_ NOT IN (1, 6, 7)
   ```
   Même règle que `usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4` : affectation active aujourd'hui, PDV actif. La société vient du PDV (`steRattachFk_`). Un gérant présent sur plusieurs PDV de la même société ne sort qu'une fois.
2. Il construit la clé AD : `I_AGENT` complété à gauche par des zéros sur 8 caractères (`241653` → `00241653`), puis cherche `employeeID`.
3. Il recherche dans AD :
   - **Société 16 (ETEP)** : recherche de `employeeID` dans l'OU `SharedMailbox`, ce qui donne un `sAMAccountName` du type `xxx_ETEP`. On retire `_ETEP` (sans tenir compte de la casse), puis on cherche ce `sAMAccountName` dans tout le domaine.
   - **Autres sociétés** : recherche de `employeeID` dans tout le domaine (`DC=ltrf,DC=fr`).
4. Si un compte est trouvé, il récupère `employeeID`, `userPrincipalName`, `userAccountControl`, le chemin LDAP, `description` et `mail`.
   - `Admail_disponible` = `O` si le compte est **actif** (bit 2 de `userAccountControl` absent), `N` s'il est **désactivé**.
   - `AdStatus` = `Found by EmployeID`.
   - S'il n'est pas trouvé : `AdMail` et `Admail_disponible` sont vides, et les autres champs AD aussi.
5. Il écrit une ligne par gérant (et par société) dans le CSV.

## Principe du job Talend

Le script interroge AD **une ou deux fois par agent**. En Talend, on charge AD **une seule fois** en mémoire, puis on fait les rapprochements dans un **tMap**. Le résultat est le même, en beaucoup plus rapide.

```
[Pré-job]   tPrejob → tMSSqlConnection (base EBX)

[AD]        tLDAPInput_DOMAINE (DC=ltrf,DC=fr)   → tMap_AD → tHashOutput_AD
            tLDAPInput_ETEP (OU=SharedMailbox…)  → tHashOutput_ETEP
                 │ OnSubjobOk
                 ▼
[Gérants]   tMSSqlInput (ref_pdv) ──row1──▶ tMap_1 ──out──▶ tFileOutputDelimited (CSV)
                                          ▲  ▲  ▲
            tHashInput_ETEP ──etep────────┘  │  │
            tHashInput_AD_ID ──adId──────────┘  │
            tHashInput_AD_SAM ──adSam───────────┘

[Post-job]  tPostjob → tMSSqlClose
```

## Contexte

| Variable | Exemple | Rôle |
|---|---|---|
| `DB_HOST` / `DB_PORT` | serveur SQL Server / `1433` | Serveur de la base EBX (celle de `CNX_MSSQL_EBX_MW`) |
| `DB_NAME` / `DB_SCHEMA` | `EBX_MW` / `dbo` | Base et schéma des tables `EBX_*_REF_PDV` |
| `DB_USER` / `DB_PASSWORD` | (compte) / (Password) | Compte SQL Server en lecture |
| `LDAP_HOST` / `LDAP_PORT` | `ltrf.fr` (ou un contrôleur de domaine) / `389` | Serveur AD |
| `LDAP_USER` / `LDAP_PASSWORD` | `compte_service@ltrf.fr` / (Password) | Compte de service AD (voir la remarque plus bas) |
| `OUTPUT_DIR` | `C:/Talend/AGENT` | Dossier du CSV |

## Réglages des composants

### tMSSqlConnection
Host `context.DB_HOST`, Port `context.DB_PORT`, Base `context.DB_NAME`, Schéma `context.DB_SCHEMA`, utilisateur et mot de passe venant du contexte. Tu peux aussi réutiliser la connexion de référentiel `CNX_MSSQL_EBX_MW` déjà utilisée dans les jobs Pulse.

### tMSSqlInput (gérants ref_pdv)
*Use an existing connection*. Requête :
```sql
"SELECT DISTINCT CAST(g.gerant_ AS VARCHAR(20)) AS I_AGENT,
        CAST(p.fichePrincipale_steRattachFk_ AS VARCHAR(20)) AS I_SOCIETE
   FROM EBX_TR_PDV_GERANT_REF_PDV g
  INNER JOIN EBX_TE_PDV_REF_PDV p ON p.fichePrincipale_code = g.pdv_
  WHERE g.gerant_ IS NOT NULL
    AND g.dateDebut <= CAST(GETDATE() AS DATE)
    AND ISNULL(g.dateFin, '9999-12-31') >= CAST(GETDATE() AS DATE)
    AND p.fichePrincipale_statut_ NOT IN (1, 6, 7)"
```
Schéma : 2 colonnes de type **String** : `I_AGENT, I_SOCIETE`.
Coche *Trim all columns* dans les paramètres avancés.

### tLDAPInput_DOMAINE (tout le domaine)
| Paramètre | Valeur |
|---|---|
| Host / Port | `context.LDAP_HOST` / `context.LDAP_PORT` |
| Base DN | `"DC=ltrf,DC=fr"` |
| Protocole | LDAP |
| Authentification | cochée : `context.LDAP_USER` / `context.LDAP_PASSWORD` |
| Redirection des références | **IGNORE** |
| Filtre | `"(|(employeeID=*)(&(objectCategory=person)(objectClass=user)))"` |
| Pagination | **cochée**, taille de page **1000** (AD limite à 1000 résultats sans pagination) |
| Séparateur multivalué | `";"` |

Le filtre charge les objets qui ont un `employeeID` (recherche classique), **plus** tous les comptes utilisateurs. Pour l'ETEP, le script cherche le compte LTRF par `sAMAccountName`, même s'il n'a pas d'`employeeID`.

Schéma (type String). Le nom de colonne doit être exactement le nom de l'attribut AD :
`dn, employeeID, sAMAccountName, userPrincipalName, userAccountControl, description, mail`
(La colonne nommée `dn` reçoit le DN complet de l'objet.)

### tMap_AD (prépare le dictionnaire AD) → tHashOutput_AD
Recopie toutes les colonnes et ajoute :
- `SAM_UPPER` = `row.sAMAccountName == null ? null : row.sAMAccountName.toUpperCase()`

AD compare les `sAMAccountName` sans tenir compte de la casse, alors que le tMap en tient compte : on compare donc en majuscules.

### tLDAPInput_ETEP (boîtes partagées ETEP) → tHashOutput_ETEP
Mêmes réglages que le premier, sauf :
- Filtre : `"(employeeID=*)"`
- Base DN : `"OU=SharedMailbox,OU=Office365,OU=AppGroups,OU=SiegeLTRF,DC=ltrf,DC=fr"`
- Schéma : `employeeID, sAMAccountName`

### tHashInput (3 lectures)
- `tHashInput_ETEP` est lié à `tHashOutput_ETEP`.
- `tHashInput_AD_ID` et `tHashInput_AD_SAM` sont **tous deux** liés à `tHashOutput_AD` : on lit deux fois le même dictionnaire, avec deux clés de jointure différentes.

### tMap_1 (cœur de la logique)
Entrées, dans cet ordre :

| Entrée | Type de jointure | Clé (colonne du lookup = expression) |
|---|---|---|
| `row1` (agents) | principal | — |
| `etep` | Left Outer Join, **First match** | `employeeID` = `"16".equals(row1.I_SOCIETE) ? String.format("%8s", row1.I_AGENT).replace(' ', '0') : ""` |
| `adId` | Left Outer Join, **First match** | `employeeID` = `"16".equals(row1.I_SOCIETE) ? "" : String.format("%8s", row1.I_AGENT).replace(' ', '0')` |
| `adSam` | Left Outer Join, **First match** | `SAM_UPPER` = `etep.sAMAccountName == null ? "" : etep.sAMAccountName.replaceAll("(?i)_ETEP", "").toUpperCase()` |

`First match` reproduit le `FindOne()` du script : on garde le premier compte trouvé.

Variables (*Var*) :

| Variable | Type | Expression |
|---|---|---|
| `etep` | boolean | `"16".equals(row1.I_SOCIETE)` |
| `trouve` | boolean | `Var.etep ? adSam.SAM_UPPER != null : adId.employeeID != null` |
| `uac` | String | `!Var.trouve ? null : (Var.etep ? adSam.userAccountControl : adId.userAccountControl)` |

Sortie `out` (10 colonnes String). Les colonnes Oracle `c_etat`, `l_etat`, `l_civilite_nom`, `l_email_ad` et `mail_disponible` n'existent plus :

| Colonne | Expression |
|---|---|
| `I_agent` | `row1.I_AGENT` |
| `i_societe` | `row1.I_SOCIETE` |
| `AdStatus` | `Var.trouve ? "Found by EmployeID" : null` |
| `AdEmployeeID` | `!Var.trouve ? null : (Var.etep ? adSam.employeeID : adId.employeeID)` |
| `AduserPrincipalName` | `!Var.trouve ? null : (Var.etep ? adSam.userPrincipalName : adId.userPrincipalName)` |
| `AduserAccountControl` | `Var.uac` |
| `AdPath` | `!Var.trouve ? null : "LDAP://" + (Var.etep ? adSam.dn : adId.dn)` |
| `AdDescription` | `!Var.trouve ? null : (Var.etep ? adSam.description : adId.description)` |
| `AdMail` | `!Var.trouve ? "" : (Var.etep ? adSam.mail : adId.mail)` |
| `Admail_disponible` | `(!Var.trouve \|\| Var.uac == null) ? "" : ((Integer.parseInt(Var.uac.trim()) & 2) == 2 ? "N" : "O")` |

### tFileOutputDelimited
- Fichier : `context.OUTPUT_DIR + "/GerantCompletedByAd.csv"`
- Séparateur de champ : `","`. Coche *Inclure l'en-tête*.
- Paramètres avancés : *CSV options* coché, délimiteur de texte `"\""` (comme `Export-Csv`) ; encodage **UTF-8** (Talend n'écrit pas de BOM, comme `utf8NoBOM`).
- *Ajouter* (Append) : décoché. Le script ajoutait à la fin du fichier existant ; avec Talend, le fichier est réécrit à chaque exécution. Coche *Ajouter* si tu veux garder l'ancien comportement.


## Différences avec le script, à connaître

- **Authentification AD** : le script utilise le compte Windows de la personne qui le lance (authentification intégrée). Talend a besoin d'un **compte de service AD** avec un mot de passe, en lecture seule sur l'annuaire.
- **Attributs multivalués** : si `description` a plusieurs valeurs, Talend les concatène avec `;`, alors que le script ne garde que la première.
- **Gérant vide** : exclu par la requête (`g.gerant_ IS NOT NULL`).
- **Société 16 (ETEP)** : la règle est conservée telle quelle (`"16".equals(row1.I_SOCIETE)`). À vérifier : le code société porté par `fichePrincipale_steRattachFk_` dans EBX doit bien valoir `16` pour l'ETEP, comme `I_SOCIETE` dans Oracle.
- **Performance** : 2 requêtes LDAP au total, au lieu d'une ou deux par agent.
