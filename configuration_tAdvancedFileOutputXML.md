# Configuration pas à pas - tAdvancedFileOutputXML avec CDATA

## Étape 1: Créer le Job

1. Créez un nouveau Job dans Talend Studio
2. Faites glisser les composants suivants sur le canvas:
   - `tRowGenerator` (ou votre source de données)
   - `tAdvancedFileOutputXML`

## Étape 2: Configurer le schéma d'entrée

Dans le composant source (exemple: tRowGenerator):

```
Schéma:
┌────────────┬──────────┬──────────────────────────────────────┐
│ Colonne    │ Type     │ Exemple de valeur                    │
├────────────┼──────────┼──────────────────────────────────────┤
│ id         │ Integer  │ 1                                    │
│ titre      │ String   │ "Mon article"                        │
│ contenu    │ String   │ "<p>HTML content</p>"                │
│ auteur     │ String   │ "Auteur"                             │
└────────────┴──────────┴──────────────────────────────────────┘
```

## Étape 3: Configurer tAdvancedFileOutputXML

### 3.1 Onglet "Component" - Basic settings

```
┌─────────────────────────────────────────────────────────────┐
│ File Name/Stream                                            │
│ "/home/user/output/result.xml"                              │
│                                                             │
│ Create directory if not exists: ✓                          │
│                                                             │
│ Advanced parameters:                                         │
│ ├─ Encoding: UTF-8                                          │
│ ├─ Row separator: Default                                   │
│ └─ Split output in several files: ☐                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Onglet "Advanced settings" - Group by

Cliquez sur le bouton "Edit schema" ou l'icône de structure d'arbre.

**Configuration de l'arbre XML:**

```
📁 root (Document root)
  │
  └─ 📁 articles (Element)
      │
      └─ 📁 article (Element) ← Loop on "Main" input
          │
          ├─ 📄 id (Element)
          │   └─ Column: id
          │
          ├─ 📄 titre (Element)
          │   └─ Column: titre
          │
          ├─ 📄 contenu (Element) ⭐ CONFIGURATION CDATA ICI
          │   ├─ Column: contenu
          │   └─ ✓ Use CDATA
          │
          └─ 📄 auteur (Element)
              └─ Column: auteur
```

### 3.3 Configuration détaillée pour l'élément avec CDATA

Pour configurer l'élément "contenu" avec CDATA:

1. **Clic droit sur l'élément "contenu"** dans l'arbre
2. **Sélectionner "Properties"** ou double-cliquer
3. **Configuration dans la fenêtre de propriétés:**

```
┌─────────────────────────────────────────────────────────────┐
│ Element properties: contenu                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Node name:    contenu                                       │
│                                                             │
│ Node type:    ● Element                                     │
│               ○ Attribute                                   │
│               ○ Name space                                  │
│                                                             │
│ Default value or column:                                    │
│               [Dropdown: contenu] ◄── Sélectionner colonne  │
│                                                             │
│ ☑ Use CDATA   ◄────────────────── COCHER CETTE CASE !      │
│                                                             │
│ Null handling:                                              │
│               ● Empty                                       │
│               ○ Skip element                                │
│               ○ Default value: [_________]                  │
│                                                             │
│               [OK]  [Cancel]                                │
└─────────────────────────────────────────────────────────────┘
```

## Étape 4: Options alternatives selon la version de Talend

### Option A: Via le tableau de mapping (versions récentes)

Dans certaines versions de Talend, vous pouvez voir un tableau de mapping:

```
┌──────────┬──────────┬──────────┬──────────┬────────────┐
│ XPath    │ Column   │ Type     │ Pattern  │ As CDATA   │
├──────────┼──────────┼──────────┼──────────┼────────────┤
│ /id      │ id       │ Element  │          │ ☐          │
│ /titre   │ titre    │ Element  │          │ ☐          │
│ /contenu │ contenu  │ Element  │          │ ✓          │ ◄── COCHER
│ /auteur  │ auteur   │ Element  │          │ ☐          │
└──────────┴──────────┴──────────┴──────────┴────────────┘
```

### Option B: Si l'option CDATA n'est pas visible

Si vous ne trouvez pas l'option "Use CDATA":

1. Vérifiez que le type est bien "Element" (pas "Attribute")
2. Mettez à jour votre version de Talend
3. Ou utilisez la méthode alternative avec tMap (voir ci-dessous)

## Méthode alternative: Préparation avec tMap

Si l'option CDATA n'est pas disponible, ajoutez un composant tMap:

```
[Source] ──> [tMap] ──> [tAdvancedFileOutputXML]
```

### Configuration du tMap:

**Expression pour le champ contenu:**
```java
// Ne PAS utiliser cette méthode si Use CDATA est disponible
// Ceci est uniquement si l'option native n'existe pas
row.contenu // Gardez le contenu tel quel
```

Puis dans tAdvancedFileOutputXML, assurez-vous que:
- Le type est "Element"
- L'option "Use CDATA" est cochée dans les propriétés

## Étape 5: Exécuter et vérifier

1. **Exécutez le job** (F6 ou bouton Run)
2. **Ouvrez le fichier XML généré**
3. **Vérifiez que les balises CDATA sont présentes:**

```xml
<contenu><![CDATA[votre contenu ici]]></contenu>
```

## Dépannage

### Problème 1: Les balises CDATA n'apparaissent pas

**Symptômes:**
```xml
<contenu>&lt;p&gt;HTML&lt;/p&gt;</contenu>
```

**Solutions:**
- Vérifiez que "Use CDATA" est bien coché
- Assurez-vous que le type est "Element" et non "Attribute"
- Redémarrez Talend Studio et réessayez

### Problème 2: Le contenu est vide

**Symptômes:**
```xml
<contenu><![CDATA[]]></contenu>
```

**Solutions:**
- Vérifiez le mapping de colonne
- Assurez-vous que la colonne source contient bien des données
- Vérifiez le "Null handling"

### Problème 3: Erreur "CDATA not closed"

**Cause:** Votre contenu contient la séquence "]]>"

**Solution:** Nettoyez vos données avant avec tMap:
```java
StringHandling.CHANGE(row.contenu, "]]>", "] ]>")
```

## Versions de Talend supportées

- ✅ Talend Open Studio 6.x et supérieur
- ✅ Talend Data Integration 7.x et 8.x
- ✅ Talend Cloud Data Integration
- ⚠️  Versions antérieures à 6.0: peut nécessiter la méthode alternative

## Ressources supplémentaires

- Documentation Talend officielle: https://help.talend.com
- Forum Talend: https://community.talend.com
- Exemples de projets: Voir le dossier `examples/` dans ce dépôt
