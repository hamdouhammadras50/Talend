# Réponse à Nicolas MANGANAS – ticket 52654

@Nicolas MANGANAS

Bonjour Nicolas,

La procédure stockée `dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4` est prête, à partir de ta requête. Elle reprend tes demandes :

- **Code gérant en poste** : j'ai remplacé le filtre `dateFin = '9999-12-31'` par la recherche de l'affectation active à la date du traitement (`dateDebut <= date du jour <= dateFin`). Les affectations futures sont donc ignorées. Avec ton exemple (PDV 1LAA, traitement le 16/10), on récupère bien le gérant 00000001. Le jour de la bascule (31/10/2026), les deux affectations se chevauchent : la procédure prend celle qui commence en dernier, donc le gérant 00000002.
- **Surfaces** : les valeurs sont arrondies à 2 décimales (type `DECIMAL(18,2)`). Je n'ai pas utilisé `FORMAT(..., 'N2', 'fr-FR')`, qui renvoie du texte avec une virgule et un séparateur de milliers.
- **CreatedAtUtc** : le job Talend passe la date de lancement en paramètre. Elle est donc la même sur toutes les lignes du lot.
- **Traitement quotidien en full, sans commit intermédiaire** : le job Talend vide puis recharge `S4_AffectationGerantCourant` dans une seule transaction, avec un commit unique à la fin. En cas d'erreur, tout est annulé et la table garde les données de la veille.

Deux points à valider avec toi :
1. Comme dans ta requête, un PDV sans gérant en poste à la date du traitement (par exemple avec seulement une affectation future) n'est pas remonté. Préfères-tu qu'on le remonte avec un code gérant vide ?
2. La date de référence pour trouver le gérant est la date locale (heure de Paris), et non la date UTC, pour éviter de remonter le gérant de la veille si le job tourne juste après minuit. Ça te convient ?

Je fais les tests sur la base de recette Icare et je reviens vers toi avec les résultats.

Hamdou
