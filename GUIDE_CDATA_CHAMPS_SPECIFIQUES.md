# Comment ajouter CDATA sur certains champs spécifiques

## Méthode rapide (3 étapes)

### Étape 1: Ouvrir l'éditeur de structure XML

1. Double-cliquez sur votre composant **tAdvancedFileOutputXML**
2. Allez dans l'onglet **"Advanced settings"**
3. Cliquez sur le bouton **"Edit schema"** ou l'icône d'arbre 🌳

### Étape 2: Configurer le champ avec CDATA

Dans l'arbre XML qui s'affiche:

1. **Trouvez l'élément** où vous voulez CDATA (par exemple: "description", "contenu", etc.)
2. **Double-cliquez** sur cet élément OU **Clic droit → Properties**
3. Dans la fenêtre qui s'ouvre:

```
┌─────────────────────────────────────────────┐
│ Element properties                          │
├─────────────────────────────────────────────┤
│                                             │
│ Node name:    description                   │
│                                             │
│ Node type:    ● Element                     │
│               ○ Attribute                   │
│                                             │
│ Default value or column:                    │
│               [description    ▼]            │
│                                             │
│ ☑ Use CDATA   ◄── COCHER CETTE CASE !      │
│                                             │
│ [OK]  [Cancel]                              │
└─────────────────────────────────────────────┘
```

4. **Cochez la case "Use CDATA"**
5. Cliquez sur **OK**

### Étape 3: Répéter pour les autres champs

Pour chaque champ où vous voulez CDATA:
- Répétez l'étape 2 sur chaque élément concerné
- Vous pouvez avoir CDATA sur plusieurs champs en même temps

## Exemple concret

### Scenario: Export de produits avec HTML

**Données:**
```
id       | nom           | description                  | prix
---------|---------------|------------------------------|-------
1        | Produit A     | <p>Texte HTML</p>           | 19.99
2        | Produit B     | <b>Important</b> & urgent   | 29.99
```

**Configuration:**

1. Structure XML:
```
root
└── produits
    └── produit (loop)
        ├── id          ← PAS de CDATA
        ├── nom         ← PAS de CDATA
        ├── description ← AVEC CDATA (contient HTML)
        └── prix        ← PAS de CDATA
```

2. Sur l'élément "description" uniquement:
   - Double-clic
   - Cocher "Use CDATA"
   - OK

**Résultat XML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <produits>
    <produit>
      <id>1</id>
      <nom>Produit A</nom>
      <description><![CDATA[<p>Texte HTML</p>]]></description>
      <prix>19.99</prix>
    </produit>
    <produit>
      <id>2</id>
      <nom>Produit B</nom>
      <description><![CDATA[<b>Important</b> & urgent]]></description>
      <prix>29.99</prix>
    </produit>
  </produits>
</root>
```

## Variantes selon la version de Talend

### Version avec tableau de mapping

Dans certaines versions, vous verrez un tableau:

```
┌──────────────┬──────────┬─────────┬──────────────┐
│ XPath        │ Column   │ Type    │ As CDATA     │
├──────────────┼──────────┼─────────┼──────────────┤
│ /id          │ id       │ Element │ ☐            │
│ /nom         │ nom      │ Element │ ☐            │
│ /description │ desc     │ Element │ ☑            │ ◄── Cocher ici
│ /prix        │ prix     │ Element │ ☐            │
└──────────────┴──────────┴─────────┴──────────────┘
```

**Plus simple:** Cochez directement dans la colonne "As CDATA"!

### Version avec menu contextuel

1. Clic droit sur l'élément
2. Menu → "CDATA" → Cocher
3. Validez

## Quand utiliser CDATA?

### ✅ Utilisez CDATA pour les champs contenant:

| Type de contenu | Exemple | Raison |
|----------------|---------|--------|
| HTML | `<p>Texte</p>` | Évite l'échappement des balises |
| XML embarqué | `<data>...</data>` | Préserve la structure |
| Caractères spéciaux | `Prix < 10€ & > 5€` | Évite `&lt;` et `&amp;` |
| JSON | `{"key": "value"}` | Préserve les guillemets |
| Code source | `if (x > 5) {...}` | Préserve la syntaxe |
| URLs avec & | `url?a=1&b=2` | Évite l'échappement |

### ❌ N'utilisez PAS CDATA pour:

| Type de contenu | Raison |
|----------------|--------|
| Nombres simples | Inutile: `123` |
| Texte simple | Inutile: `"Bonjour"` |
| Dates | Inutile: `2024-01-15` |
| Booléens | Inutile: `true/false` |

## Points importants

### ⚠️ Règle #1: Seulement sur les Elements
- CDATA fonctionne UNIQUEMENT avec **"Element"**
- NE fonctionne PAS avec **"Attribute"**

### ⚠️ Règle #2: Caractères interdits dans CDATA
- CDATA ne peut pas contenir: `]]>`
- Si vos données contiennent `]]>`, nettoyez-les avant avec tMap:

```java
// Dans tMap, avant tAdvancedFileOutputXML
StringHandling.CHANGE(row.description, "]]>", "] ]>")
```

### ⚠️ Règle #3: Un champ = un choix
- Soit CDATA
- Soit échappement XML normal
- Pas les deux en même temps

## Dépannage rapide

### Problème: L'option "Use CDATA" n'apparaît pas

**Cause:** Vous êtes sur un Attribute et non un Element

**Solution:**
1. Vérifiez que Node type = "Element"
2. Si vous avez besoin d'un attribut, vous ne pouvez pas utiliser CDATA
3. Alternative: Mettez le contenu dans un élément fils

**Exemple:**
```xml
<!-- MAUVAIS: attribut avec CDATA = impossible -->
<produit description="<![CDATA[...]]>"/>

<!-- BON: élément avec CDATA -->
<produit>
  <description><![CDATA[...]]></description>
</produit>
```

### Problème: CDATA ne s'affiche pas dans le XML

**Vérifications:**
1. ✓ Case "Use CDATA" bien cochée?
2. ✓ Type = "Element"?
3. ✓ Colonne bien mappée?
4. ✓ Données non vides?

**Solution:** Réouvrez les propriétés et re-cochez "Use CDATA"

### Problème: Tout le contenu est en CDATA

**Cause:** Vous avez coché sur le mauvais niveau (parent au lieu de l'enfant)

**Solution:** Décochez CDATA sur le parent, cochez uniquement sur les champs concernés

## Résumé en 3 lignes

1. **Ouvrir** l'éditeur de structure XML (Advanced settings → Edit schema)
2. **Double-clic** sur l'élément concerné
3. **Cocher** "Use CDATA" et valider

C'est tout! 🎉

## Exemple visuel complet

```
Avant de cocher CDATA:
<contenu>&lt;p&gt;Hello&lt;/p&gt;</contenu>
         ↑ Caractères échappés, pas lisible

Après avoir coché CDATA:
<contenu><![CDATA[<p>Hello</p>]]></contenu>
         ↑ Contenu préservé tel quel
```

## Questions fréquentes

**Q: Puis-je mettre CDATA sur tous les champs?**
R: Oui, mais c'est inutile si vous n'avez pas de caractères spéciaux.

**Q: Ça marche sur les attributs XML?**
R: Non, uniquement sur les éléments.

**Q: Mon XML est plus gros avec CDATA?**
R: Légèrement oui (+12 caractères par champ: `<![CDATA[]]>`), mais c'est négligeable.

**Q: Ça ralentit le job?**
R: Non, impact imperceptible.

**Q: Puis-je enlever CDATA plus tard?**
R: Oui, décochez simplement "Use CDATA".

## Support

Pour plus d'aide:
- Voir le fichier `configuration_tAdvancedFileOutputXML.md` pour un guide complet
- Voir le fichier `exemple_job_cdata.txt` pour un exemple de job
- Forum Talend: https://community.talend.com
