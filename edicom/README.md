# Flux XML quotidien vers EDICOM

Job Talend `EDICOM_Commandes_XML` : il extrait les commandes APPRODIRECT des fournisseurs 47451 et 01811 envoyées depuis 24 h, génère un fichier XML au format EDICOM (`<Commande>` → `<Entete>` + `<Lignes>/<Ligne>`), puis le dépose en SFTP.

## Contenu

| Fichier | Rôle |
|---|---|
| `EDICOM_Commandes_XML_0.1.zip` | **Archive à importer dans Talend Studio** |
| `EDICOM_Commandes.xsd` | Schéma XSD du fichier : structure, types, longueurs et obligations repris des tables `COMMANDE_ENVOI` et `ARTICLE_COMMANDE_ENVOI` |
| `exemple_EDICOM_COMMANDES.xml` | Exemple de fichier généré (données fictives), pour présenter le format à EDICOM |
| `src/extraction_commandes.sql` | Requête d'extraction utilisée par le job |
| `src/tJava_init.java`, `src/tJava_bilan.java` | Code des tJava (nom du fichier, bilan) |
| `src/build_talend_zip.py` | Régénère le zip : `python3 src/build_talend_zip.py .` |

## Import dans Talend Studio

1. Clic droit sur **Job Designs** → **Import items**.
2. **Select archive file** → `EDICOM_Commandes_XML_0.1.zip`.
3. Cocher le job `EDICOM_Commandes_XML` → **Finish**. Il apparaît sous `Job Designs/EDICOM`.
4. Onglet **Contexts** : renseigner les valeurs (voir ci-dessous).

## Schéma du job

```
tPrejob ──OnComponentOk──▶ tJava (nom du fichier) ──OnComponentOk──▶ tOracleConnection (APPRODIRECT)

tOracleInput (requête EDICOM) ──row1──▶ tAdvancedFileOutputXML
      │
  OnSubjobOk
      ▼
tJava (bilan) ──If: context.SFTP_ACTIVE && NB_LINE > 0──▶ tFTPPut (SFTP EDICOM)

tPostjob ──OnComponentOk──▶ tOracleClose
```

## Configuration du tAdvancedFileOutputXML

Arbre XML (bouton **Configure Xml Tree**) :

```
Commandes                       (racine)
└── Commande                    ← élément de groupe ("Set As Group Element")
    ├── Entete
    │   ├── CODE_CMDE           ← colonne CODE_CMDE
    │   ├── …                   ← une balise par colonne d'en-tête (22)
    │   └── I_GLN_DESTINATAIRE_DE_CMDE
    └── Lignes
        └── Ligne               ← élément de boucle ("Set As Loop Element")
            ├── CODE_CMDE_1     ← colonne CODE_CMDE (même valeur que dans l'en-tête ; Talend impose le suffixe _1)
            ├── CODE_ARTICLE_FOURN_CMDE
            ├── …               ← une balise par colonne de ligne (17)
            └── L_OPERATION
```

- Le groupe se fait sur les valeurs de l'`<Entete>` : une seule `<Entete>` par commande, avec une ou plusieurs `<Ligne>` dans `<Lignes>`. La requête est triée par commande.
- Paramètres : nom de fichier `(String) globalMap.get("EDICOM_FILE_PATH")`, encodage UTF-8, *Create directory if not exists*, *Create empty element if needed* (une valeur NULL donne une balise vide `<X/>`), *Delete empty file* (aucun fichier s'il n'y a pas de commande), mode de génération *Slow and memory-consuming (Dom4j)*.
- Les caractères spéciaux (`&`, `<`, `>`) sont échappés par le composant.
- Le fichier est en UTF-8 et s'appelle `EDICOM_COMMANDES_yyyyMMdd_HHmmss.xml`.
- S'il n'y a aucune commande, aucun fichier n'est créé et rien n'est envoyé.

## Variables de contexte

| Variable | Défaut | Description |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_SERVICE_NAME` | localhost / 1521 / ORCL | Base Oracle (connexion par *service name*, version Oracle 18 et plus) |
| `DB_USER` / `DB_PASSWORD` | approdirect / – | Identifiants Oracle |
| `OUTPUT_DIR` | `C:/Talend/EDICOM/out` | Dossier local où le XML est écrit |
| `FILE_PREFIX` | `EDICOM_COMMANDES_` | Préfixe du nom de fichier |
| `SFTP_ACTIVE` | **false** | `false` = phase de recette, fichier local uniquement |
| `SFTP_HOST` / `SFTP_PORT` / `SFTP_USER` / `SFTP_PASSWORD` / `SFTP_REMOTE_DIR` | – | Dépôt SFTP EDICOM |

## Phase de recette

Laisser `SFTP_ACTIVE = false`, lancer le job (Run) : le fichier XML est créé dans `OUTPUT_DIR` et peut être transmis à EDICOM pour validation.

## Mise en production

1. Renseigner les paramètres SFTP et passer `SFTP_ACTIVE = true`.
2. Planifier deux exécutions par jour, à **07h30** et **10h00** :
   - avec TMC / TAC : créer une tâche avec deux déclencheurs (07:30 et 10:00) ;
   - sinon : **Build Job**, puis planifier le script `EDICOM_Commandes_XML_run.bat` (Planificateur de tâches Windows) ou `_run.sh` (cron : `30 7 * * *` et `0 10 * * *`).

## Points à confirmer avec B. BUFFEL / EDICOM

1. **Balise racine** : un fichier contient plusieurs commandes, elles sont donc englobées dans `<Commandes>` (modifiable dans l'arbre du tAdvancedFileOutputXML). Si EDICOM attend **un fichier par commande**, il faudra adapter le job.
2. **Doublons entre 07h30 et 10h00** : le filtre `date_envoi_cmde > sysdate - 1` (24 h glissantes) reprend à 10h00 les commandes déjà envoyées à 07h30. Il faudra peut-être un autre filtre, par exemple un flag d'envoi ou la date du dernier passage.
3. **Format des dates** : ISO (`YYYY-MM-DD`, et `YYYY-MM-DD HH24:MI:SS` pour `DATE_ENVOI_CMDE`), modifiable dans la requête.
4. **Colonnes des lignes** : la requête d'origine utilise `article_commande_envoi.*`. Les colonnes sont ici listées explicitement, d'après le modèle XML du mail ; le code commande est repris en tête de chaque `<Ligne>` sous la balise `<CODE_CMDE_1>`.

## Validation XSD

`EDICOM_Commandes.xsd` décrit le fichier attendu :
- **Structure** : `Commandes` / `Commande` (1..n) / `Entete` + `Lignes` / `Ligne` (1..n). L'ordre des balises est imposé.
- **Textes** (`VARCHAR2(n)`) : `n` caractères maximum. Une valeur vide est autorisée.
- **Nombres** (`NUMBER(p,s)`) : `p` chiffres au total, dont `s` décimales. Si la colonne est nullable, la balise vide est autorisée.
- **Dates** : `AAAA-MM-JJ`, et `AAAA-MM-JJ HH:MI:SS` pour `DATE_ENVOI_CMDE`. La balise vide est autorisée.
- **Obligatoires** (`NOT NULL`) : `CODE_CMDE` (en-tête), `CODE_CMDE_1` (ligne), `I_LIGNE_CMDE` et `N_MULTIPLE_COMMANDE`.
- **Unicité** : un `CODE_CMDE` par fichier, et un `I_LIGNE_CMDE` par commande.

Pour valider un fichier dans Talend, utilise le composant **tXSDValidator** après le tAdvancedFileOutputXML. Hors Talend : `xmllint --noout --schema EDICOM_Commandes.xsd fichier.xml`.
