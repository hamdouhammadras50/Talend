# Guide: Ajouter des balises CDATA dans tAdvancedFileOutputXML

## Configuration du composant tAdvancedFileOutputXML

Pour ajouter des balises CDATA dans votre fichier XML de sortie, suivez ces étapes:

### Méthode 1: Utiliser le mapping XML avec CDATA

1. **Ouvrir le composant tAdvancedFileOutputXML**
   - Double-cliquez sur le composant dans votre job

2. **Configurer le mapping XML**
   - Allez dans l'onglet "Advanced settings" ou "Paramètres avancés"
   - Dans la partie "Group by" ou mapping des éléments

3. **Ajouter CDATA pour un champ spécifique**
   - Pour chaque colonne où vous voulez ajouter CDATA:
     - Cochez l'option **"Use CDATA"** ou **"Utiliser CDATA"**
     - Ou dans certaines versions, utilisez l'option **"As CDATA"**

### Méthode 2: Utiliser une expression personnalisée

Si l'option CDATA n'est pas directement disponible dans votre version:

1. **Ajouter un tMap avant tAdvancedFileOutputXML**
   - Créez une nouvelle colonne qui encapsule votre texte avec CDATA
   - Expression: `"<![CDATA[" + row.votreChamp + "]]>"`

2. **Configuration dans tAdvancedFileOutputXML**
   - Dans le mapping, pour le champ concerné:
   - Cochez **"Use CDATA"** si disponible
   - Ou modifiez le type de sortie pour qu'il soit en mode texte brut

### Méthode 3: Modification du schéma XML

Dans le mapping tree du composant:

1. Sélectionnez l'élément où vous voulez CDATA
2. Clic droit → Properties
3. Cherchez l'option "Content Type" ou "Type de contenu"
4. Sélectionnez **"CDATA"** dans la liste

### Exemple de configuration

```xml
<!-- Sans CDATA -->
<description>Texte avec des &lt;balises&gt; &amp; caractères spéciaux</description>

<!-- Avec CDATA -->
<description><![CDATA[Texte avec des <balises> & caractères spéciaux]]></description>
```

## Cas d'usage typiques

### Exemple 1: Description produit avec HTML

```
Input schema:
- id (Integer)
- nom (String)
- description (String) ← Contient du HTML

Configuration:
- Champ "description": cocher "Use CDATA"
```

### Exemple 2: Contenu JSON dans XML

```
Input schema:
- transaction_id (String)
- data_json (String) ← Contient du JSON

Configuration:
- Champ "data_json": cocher "Use CDATA"
```

## Points importants

- ✅ Utilisez CDATA pour les champs contenant:
  - Des balises HTML/XML
  - Des caractères spéciaux (&, <, >, ", ')
  - Du code JSON ou JavaScript
  - Des données non structurées

- ⚠️ CDATA n'est PAS nécessaire pour:
  - Des chaînes simples sans caractères spéciaux
  - Des nombres
  - Des dates

## Dépannage

**Problème**: L'option CDATA n'apparaît pas
- **Solution**: Vérifiez que vous êtes bien dans le mapping de l'élément (pas de l'attribut)
- **Alternative**: Utilisez la méthode 2 avec tMap

**Problème**: Le CDATA apparaît comme texte
- **Solution**: Vérifiez que le type de colonne est bien défini comme String/Text
- **Alternative**: Désactivez l'échappement XML pour ce champ

**Problème**: Erreur de génération XML
- **Solution**: Assurez-vous que votre contenu CDATA ne contient pas la séquence "]]>"
