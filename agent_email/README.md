# AGENT_EMAIL_AD – matricule + mail depuis Active Directory

Reprise en Talend de `GetAgentEmail.ps1`, simplifiée : le job produit la liste **matricule → mail** en lisant **uniquement Active Directory**. Aucune source externe : ni Oracle (`REFERENTIEL.AGENT`), ni SQL Server, et aucune mise à jour.

Sortie : `MatriculeMailAd.csv` (séparateur `;`, en-tête, UTF-8)

```
MATRICULE;MAIL
"00241653";"jean.dupont@lagardere-tr.fr"
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `AGENT_EMAIL_AD_0.1.zip` | Job Talend à importer (*Job Designs* → *Importer des éléments*) |
| `src/build_talend_zip.py` | Régénère le zip : `python3 src/build_talend_zip.py .` |

⚠️ Ce zip est généré par script, pas par Talend Studio. Si le Studio le refuse (« élément invalide »), monte le job à la main avec le guide ci-dessous.

## Règles

1. **Matricule** = attribut AD `employeeID` (8 caractères, complété par des zéros, ex. `00241653`).
2. **Cas ETEP (ancienne société 16)** : le compte LTRF de l'agent n'a pas d'`employeeID`. Le matricule est porté par une **boîte partagée** `xxx_ETEP` dans l'OU `SharedMailbox`. On relie la boîte au compte en retirant `_ETEP` du `sAMAccountName` (`jdupont_ETEP` → `jdupont`), puis on prend le mail du compte `jdupont`.
3. Si un compte a une boîte `_ETEP`, c'est le **matricule ETEP** qui est gardé, avec le **mail du compte LTRF**. Sinon, c'est l'`employeeID` du compte.
4. Ne sortent que les comptes **actifs** (bit 2 de `userAccountControl` absent) qui ont un **matricule** et un **mail** non vides.

## Principe du job

AD est chargé une seule fois en mémoire (2 requêtes LDAP au total), puis le rapprochement se fait dans un tMap.

```
[1] tLDAPInput_1 (DC=ltrf,DC=fr) ──ad──▶ tMap_1 ──adDico──▶ tHashOutput_1      (tous les comptes)
        │ OnSubjobOk
[2] tLDAPInput_2 (OU SharedMailbox) ──etep──▶ tMap_3 ──etepDico──▶ tHashOutput_2 (boîtes ETEP)
        │ OnSubjobOk
[3] tHashInput_1 ──adCpt──▶ tMap_2 ──out──▶ tFileOutputDelimited_1 (MatriculeMailAd.csv)
                              ▲
    tHashInput_2 ──etepLk─────┘ (lookup)
```

## Contexte

| Variable | Exemple | Rôle |
|---|---|---|
| `LDAP_HOST` / `LDAP_PORT` | `ltrf.fr` / `389` | Serveur AD |
| `LDAP_USER` / `LDAP_PASSWORD` | `compte_service@ltrf.fr` / (Password) | Compte de service AD en lecture |
| `LDAP_BASEDN` | `DC=ltrf,DC=fr` | Racine de recherche des comptes |
| `LDAP_BASEDN_ETEP` | `OU=SharedMailbox,OU=Office365,OU=AppGroups,OU=SiegeLTRF,DC=ltrf,DC=fr` | OU des boîtes ETEP |
| `OUTPUT_DIR` | `C:/Talend/AGENT` | Dossier du CSV |

## Réglages des composants

### tLDAPInput_1 (comptes du domaine)
- Base DN `context.LDAP_BASEDN`, authentification avec `LDAP_USER` / `LDAP_PASSWORD`, pagination 1000, alias *never*, referrals *ignore*.
- Filtre : `"(|(employeeID=*)(&(objectCategory=person)(objectClass=user)))"`. On charge aussi les comptes sans `employeeID`, nécessaires pour le cas ETEP.
- Schéma (String) : `dn, employeeID, sAMAccountName, userPrincipalName, userAccountControl, description, mail`

### tMap_1 → tHashOutput_1
Recopie toutes les colonnes et ajoute `SAM_UPPER` = `ad.sAMAccountName == null ? null : ad.sAMAccountName.toUpperCase()`.

### tLDAPInput_2 (boîtes ETEP)
- Mêmes réglages, Base DN `context.LDAP_BASEDN_ETEP`, filtre `"(employeeID=*)"`.
- Schéma : `employeeID, sAMAccountName`

### tMap_3 → tHashOutput_2
Recopie les 2 colonnes et ajoute `SAM_LTRF_UPPER` = `etep.sAMAccountName == null ? null : etep.sAMAccountName.replaceAll("(?i)_ETEP", "").toUpperCase()`.

### tMap_2 (résultat)
- Entrée principale `adCpt` (`tHashInput_1`, lié à `tHashOutput_1`).
- Lookup `etepLk` (`tHashInput_2`, lié à `tHashOutput_2`) : *Left Outer Join*, *First match*, clé `SAM_LTRF_UPPER` = `adCpt.SAM_UPPER`.

Variables :

| Variable | Type | Expression |
|---|---|---|
| `matricule` | String | `(etepLk.employeeID != null && !etepLk.employeeID.trim().isEmpty()) ? etepLk.employeeID.trim() : (adCpt.employeeID == null ? "" : adCpt.employeeID.trim())` |
| `mail` | String | `adCpt.mail == null ? "" : adCpt.mail.trim()` |
| `actif` | boolean | `adCpt.userAccountControl != null && (Integer.parseInt(adCpt.userAccountControl.trim()) & 2) == 0` |

Sortie `out` : `MATRICULE` = `Var.matricule`, `MAIL` = `Var.mail`, avec le filtre `!Var.matricule.isEmpty() && !Var.mail.isEmpty() && Var.actif`.

### tFileOutputDelimited_1
Fichier `context.OUTPUT_DIR + "/MatriculeMailAd.csv"`, séparateur `";"`, en-tête inclus, *CSV options* avec délimiteur de texte `"\""`, encodage UTF-8, *Ajouter* décoché.

## À savoir

- **Compte de service** : le script utilisait le compte Windows de la personne qui le lançait. Talend a besoin d'un compte de service AD en lecture.
- **Comptes désactivés** : ils sont exclus. Pour les garder, retire `&& Var.actif` du filtre de sortie.
- **Doublons** : si plusieurs comptes portent le même `employeeID` (compte admin, ancien compte…), le matricule sort plusieurs fois. Ajoute un `tUniqRow` sur `MATRICULE` avant le fichier si tu veux une seule ligne par matricule.
