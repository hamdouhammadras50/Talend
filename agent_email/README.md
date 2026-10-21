# GetAgentEmail en Talend

Reprise en Talend du script PowerShell `GetAgentEmail.ps1` : pour chaque agent Oracle (`REFERENTIEL.AGENT`), on cherche le compte Active Directory correspondant, puis on écrit le résultat dans `OracleAgentCompletedByAd.csv`.

## Ce que fait le script (logique à reproduire)

1. Il lit les agents : `I_AGENT, C_ETAT, L_ETAT, L_CIVILITE_NOM, L_EMAIL_AD, MAIL_DISPONIBLE, I_SOCIETE`.
2. Il construit la clé AD : `I_AGENT` complété à gauche par des zéros sur 8 caractères (`241653` → `00241653`), puis cherche `employeeID`.
3. Il recherche dans AD :
   - **Société 16 (ETEP)** : recherche de `employeeID` dans l'OU `SharedMailbox`, ce qui donne un `sAMAccountName` du type `xxx_ETEP`. On retire `_ETEP` (sans tenir compte de la casse), puis on cherche ce `sAMAccountName` dans tout le domaine.
   - **Autres sociétés** : recherche de `employeeID` dans tout le domaine (`DC=ltrf,DC=fr`).
4. Si un compte est trouvé, il récupère `employeeID`, `userPrincipalName`, `userAccountControl`, le chemin LDAP, `description` et `mail`.
   - `Admail_disponible` = `O` si le compte est **actif** (bit 2 de `userAccountControl` absent), `N` s'il est **désactivé**.
   - `AdStatus` = `Found by EmployeID`.
   - S'il n'est pas trouvé : `AdMail` et `Admail_disponible` sont vides, et les autres champs AD aussi.
5. Il écrit une ligne par agent dans le CSV.

La requête `UPDATE REFERENTIEL.AGENT` est en commentaire dans le script : **aucune mise à jour n'est faite**. Elle est reprise ci-dessous en option, désactivée.

## Principe du job Talend

Le script interroge AD **une ou deux fois par agent**. En Talend, on charge AD **une seule fois** en mémoire, puis on fait les rapprochements dans un **tMap**. Le résultat est le même, en beaucoup plus rapide.

```
[Pré-job]   tPrejob → tOracleConnection (REFERENTIEL)

[AD]        tLDAPInput_DOMAINE (DC=ltrf,DC=fr)   → tMap_AD → tHashOutput_AD
            tLDAPInput_ETEP (OU=SharedMailbox…)  → tHashOutput_ETEP
                 │ OnSubjobOk
                 ▼
[Agents]    tOracleInput_AGENT ──row1──▶ tMap_1 ──out──▶ tFileOutputDelimited (CSV)
                                          ▲  ▲  ▲          └─(option, désactivé)─▶ tOracleOutput (UPDATE)
            tHashInput_ETEP ──etep────────┘  │  │
            tHashInput_AD_ID ──adId──────────┘  │
            tHashInput_AD_SAM ──adSam───────────┘

[Post-job]  tPostjob → tOracleClose
```

## Contexte

| Variable | Exemple | Rôle |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_SERVICE` | `PRDORA-SCAN.ltrf.fr` / `1521` / `PROD` | Base Oracle (`PRDORA-SCAN.ltrf.fr:1521/PROD`) |
| `DB_USER` / `DB_PASSWORD` | `REFERENTIEL` / (Password) | Compte Oracle |
| `LDAP_HOST` / `LDAP_PORT` | `ltrf.fr` (ou un contrôleur de domaine) / `389` | Serveur AD |
| `LDAP_USER` / `LDAP_PASSWORD` | `compte_service@ltrf.fr` / (Password) | Compte de service AD (voir la remarque plus bas) |
| `OUTPUT_DIR` | `C:/Talend/AGENT` | Dossier du CSV |

## Réglages des composants

### tOracleConnection
Type de connexion : *Oracle Service Name*. Host `context.DB_HOST`, Port `context.DB_PORT`, Service `context.DB_SERVICE`, utilisateur et mot de passe venant du contexte.

### tOracleInput_AGENT
*Use an existing connection*. Requête :
```sql
"SELECT ag.i_agent, ag.c_etat, ag.l_etat, ag.l_civilite_nom,
        ag.l_email_ad, ag.mail_disponible, ag.i_societe
   FROM referentiel.agent ag"
```
Schéma : 7 colonnes de type **String** : `I_AGENT, C_ETAT, L_ETAT, L_CIVILITE_NOM, L_EMAIL_AD, MAIL_DISPONIBLE, I_SOCIETE`.
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

Sortie `out` (15 colonnes String, dans l'ordre du CSV du script) :

| Colonne | Expression |
|---|---|
| `I_agent` | `row1.I_AGENT` |
| `c_etat` | `row1.C_ETAT` |
| `l_etat` | `row1.L_ETAT` |
| `l_civilite_nom` | `row1.L_CIVILITE_NOM` |
| `i_societe` | `row1.I_SOCIETE` |
| `l_email_ad` | `row1.L_EMAIL_AD` |
| `mail_disponible` | `row1.MAIL_DISPONIBLE` |
| `AdStatus` | `Var.trouve ? "Found by EmployeID" : null` |
| `AdEmployeeID` | `!Var.trouve ? null : (Var.etep ? adSam.employeeID : adId.employeeID)` |
| `AduserPrincipalName` | `!Var.trouve ? null : (Var.etep ? adSam.userPrincipalName : adId.userPrincipalName)` |
| `AduserAccountControl` | `Var.uac` |
| `AdPath` | `!Var.trouve ? null : "LDAP://" + (Var.etep ? adSam.dn : adId.dn)` |
| `AdDescription` | `!Var.trouve ? null : (Var.etep ? adSam.description : adId.description)` |
| `AdMail` | `!Var.trouve ? "" : (Var.etep ? adSam.mail : adId.mail)` |
| `Admail_disponible` | `(!Var.trouve \|\| Var.uac == null) ? "" : ((Integer.parseInt(Var.uac.trim()) & 2) == 2 ? "N" : "O")` |

### tFileOutputDelimited
- Fichier : `context.OUTPUT_DIR + "/OracleAgentCompletedByAd.csv"`
- Séparateur de champ : `","`. Coche *Inclure l'en-tête*.
- Paramètres avancés : *CSV options* coché, délimiteur de texte `"\""` (comme `Export-Csv`) ; encodage **UTF-8** (Talend n'écrit pas de BOM, comme `utf8NoBOM`).
- *Ajouter* (Append) : décoché. Le script ajoutait à la fin du fichier existant ; avec Talend, le fichier est réécrit à chaque exécution. Coche *Ajouter* si tu veux garder l'ancien comportement.

### Option : mise à jour Oracle (désactivée, comme dans le script)
Une deuxième sortie du tMap → **tOracleOutput** (connexion existante) :
- Table `"AGENT"`, schéma `"REFERENTIEL"`, action sur les données **Update**.
- Colonnes : `I_AGENT` (clé), `L_EMAIL_AD` = `AdMail`, `MAIL_DISPONIBLE` = `Admail_disponible`.
- Filtre de sortie dans le tMap : `Var.trouve`, pour ne pas vider l'email des agents non trouvés.
- **Désactive le composant** (clic droit → *Désactiver*) tant que la mise à jour n'est pas validée. Pense à un tOracleCommit après le flux, car l'auto-commit est désactivé.

## Différences avec le script, à connaître

- **Authentification AD** : le script utilise le compte Windows de la personne qui le lance (authentification intégrée). Talend a besoin d'un **compte de service AD** avec un mot de passe, en lecture seule sur l'annuaire.
- **Attributs multivalués** : si `description` a plusieurs valeurs, Talend les concatène avec `;`, alors que le script ne garde que la première.
- **`I_AGENT` vide** : le script plante sur un `I_AGENT` NULL ; dans Talend, la ligne sort sans correspondance AD.
- **Performance** : 2 requêtes LDAP au total, au lieu d'une ou deux par agent.
