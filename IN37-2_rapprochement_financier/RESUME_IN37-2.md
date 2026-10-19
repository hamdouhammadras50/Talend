# Résumé – DI IT-19934 / IN37-2 « Rapprochement financier »

Source : `PULSE_XBL FR IT-IT-19934 - IN37-2 Rapprochement financier.pdf` (18 pages)

## Fiche d'identité

| Élément | Valeur |
|---|---|
| Type de document | Demande d'Intervention (DI) |
| Jira | IT-19934 (lié à IT-18556 – FI28-1 Rapprochement des flux financiers) |
| ID gap | IN37-2 (le titre indique « IN38 ») |
| Type d'action | Évolution, catégorie *Medium* |
| Rédacteur | Sébastien Berger (DXC) |
| Approbateurs | François Fixot (LTR), Nicolas Manganas (LTRF) |
| Version | V1.0 – livraison initiale du 10 juin 2026 |
| Interface | « Blake & Mortimer » : SAP S/4 → SAP PO (ABAP Proxy) → BDD intermédiaire LTRF |

## Objectif

Envoyer **chaque jour, en delta**, les pièces comptables SAP des **points de vente LTRF**,
ainsi que leurs événements de rapprochement, vers une base de données intermédiaire LTRF.
Volume attendu : environ **20 000 lignes par jour**.

Types de pièces concernés :

| BLART | Signification | Type de flux (RG03) | Type de rapprochement |
|---|---|---|---|
| RB | Versement (règlement boutique) | VE | VE_VI |
| ZR | Virement (rappro bancaire) | VI | VE_VI |
| YJ | Prélèvement | PR | PR_JU |
| FF | Pièce justificative | JU | PR_JU |
| RG | Pièce de rapprochement / annulation | – | – |

Rapprochements suivis : **versement ↔ virement** et **prélèvement ↔ pièces justificatives**.

## Périmètre de sélection (pré-requis)

- **Source** : table `ACDOCA` (Journal universel).
- **Delta** : `ACDOCA.TIMESTAMP` (DEC 15, `AAAAMMJJhhmmss`) > timestamp de la dernière exécution réussie.
- **Sociétés LTRF** : set FI `ZFI_LTRF_BUKRS` = FR01, FR03, FR09, FR10, FR11, FR15, FR16.
  FR03 et FR11 ne sont pas marchandes, elles n'ont donc pas de PDV.
- **PDV LTRF** : `T001K` (BUKRS → BWKEY), puis `T001W` (BWKEY → WERKS avec `VLFKZ = 'A'`).
- **Centres de profit** : `ZREF_CP` (WERKS → PRCTR).
- **Centres de coûts** : `CSKS` (PRCTR → KOSTL).
- **Comptes** : set `ZFI_LTRF_RAPPRO_FI_RACCT`.
- **Fournisseur FF** : variable TVARVC `ZFI_LTRF_FF_LIFNR`.

## Les 3 flux à extraire

### 1. Pièces non rapprochées (`AUGBL` vide)
- RB, ZR, YJ : filtre sur la société, le centre de profit LTRF, le compte du set et le timestamp.
- FF : filtre sur la société, le centre de coûts LTRF, le fournisseur `ZFI_LTRF_FF_LIFNR` et le timestamp.
- Mapping : `F_RAPPROCHE = 0`, `F_ECART = 0`, montants d'écart à blanc.
  La DIF est renseignée (RG02) et `D_LIM_REP_DIF = BUDAT + délai` (RG00).

### 2. Pièces rapprochées (`AUGBL` non vide)
- Mêmes filtres, mais le delta se fait sur la **date de rapprochement** (`AUGDT`).
- Mapping : `F_RAPPROCHE = 1`, `N_RAPPRO = AUGBL`, `D_RAPPROCHEMENT = AUGDT`. Les champs DIF restent à blanc.
- Les écarts sont calculés en relisant les lignes de la même pièce dans `ACDOCA` :

| Règle | Compte d'écart | Champ alimenté |
|---|---|---|
| RG04 | 51100003 | `LITIGE_BANCAIRE = ABS(SUM(HSL))` |
| RG05 | 65171000 | `IMPUTATION_GERANT`, `MOTIF_ECART = "ManagerImputation"`, `MOTIF_IMPUTATION = SGTXT` (1re ligne) |
| RG06 | 62780002 | `FRAIS_CB` |
| RG07 | 75601000 | `DIFFERENCE_CHANGE` |

### 3. Annulations de rapprochement
- Filtre : `BLART = 'RG'` avec `XREVERSING = 'X'`, plus la société, le centre de coûts LTRF et le timestamp.
- SAP ne garde pas de lien vers la pièce d'origine (`AUGBL` est remis à blanc). On envoie donc la pièce
  d'annulation avec sa référence (`AWORG`, `AWREF`, `AWITEM`).
- La cible reconstitue elle-même le statut de rapprochement.

## Règles de gestion

| Règle | Contenu |
|---|---|
| RG00 | Délai pour la date limite de réponse DIF, lu dans `ZTVARVC` (+58 jours selon le mapping) |
| RG01 | Code PDV : `ZREF_CP` avec PRCTR = `ACDOCA.PRCTR`, on récupère WERKS |
| RG02 | DIF : `ZFI_DIF_TRACK` avec BUKRS/BELNR/GJAHR/BUZEI, on récupère `DIF_ID` et `ERDAT` |
| RG03 | Transco du type de pièce vers le type de rapprochement et le type de flux, **faite à l'intégration dans la BDD LTRF** |
| RG04 à RG07 | Montants d'écart (voir le tableau ci-dessus) |

Autres règles de mapping :
- **Clé fonctionnelle** : `ID_RAPPRO_FI_AX = RBUKRS-GJAHR-BELNR` et `ID_LIG_COMPTA = DOCLN`.
- **Montants** : si `HSL > 0`, il va en débit ; si `HSL < 0`, il va en crédit.
- **Mode de paiement** : caractères 5 à 7 de `XREF2` (pièces RB).
- **Champs techniques** : `D_ENVOI`, `D_TRAITE` et `SEQ_BATCH_ID` sont alimentés par SAP PO.

## Exécution, erreurs et journal

- Après un run réussi, on met à jour le timestamp de dernière exécution (base du delta suivant).
- Côté SAP, aucune erreur fonctionnelle n'est prévue : un champ absent est mappé à blanc.
  La gestion des erreurs à l'intégration LTRF (par exemple une erreur de transco) reste **à définir**
  entre SAP PO et M. Guzzardi.
- Le journal d'exécution doit contenir :
  - la période (du xxx au yyy) ;
  - les sociétés traitées ;
  - si le timestamp a été mis à jour ;
  - les nombres de lignes sélectionnées, traitées avec succès et en erreur.
- Recette : environnement D01, vérification de la sélection et du mapping.

## Points ouverts et incohérences relevés dans le document

1. **Jeux de données de test** (Karima TALLA, à faire) pour trois scénarios :
   - virement → rapprochement → annulation ;
   - virement → rapprochement → annulation → re-rapprochement avec la même pièce ;
   - virement → rapprochement → annulation → re-rapprochement avec une autre pièce.
2. **Codes de type de pièce incohérents** : la sélection utilise YJ et FF, mais RG03 cite XX et FI.
   Le type prélèvement est aussi « XX, à confirmer par F. Fixot » dans le flux 2.
3. `ID_RAPPRO_FI_AX` est typé `NUMBER`, alors que sa valeur est une concaténation avec des « - ».
   Il faut prévoir un `VARCHAR2`.
4. Pour les FF non rapprochées, le filtre parle de « date de rapprochement > timestamp » alors que
   `AUGBL` est vide. Il faut sans doute utiliser `TIMESTAMP`.
5. Pour le flux 3, les colonnes cibles de `RefDocOrg`, `RefDocNumber` et `RefDocItem` sont « à confirmer ».
6. RG00 montre une variable `ZTVARVC` `PEROP_END_ADD_DAYS = 1` (programme `ZFI_DIF_CLOSING`), alors que
   le mapping parle de +58 jours.
7. `I_AGENT` doit être alimenté « pour RB et EC », mais le type EC n'apparaît nulle part ailleurs.
8. La numérotation saute la section 4. Le titre « IN38 » ne correspond pas à l'ID gap « IN37-2 ».
9. Les rubriques « Authority check » et « Rôles » ne sont pas remplies.
