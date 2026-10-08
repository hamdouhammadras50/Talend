// Regroupement des lignes par commande (cle = CODE_CMDE), ordre de lecture conserve.
final String[] CHAMPS_ENTETE = {
    "CODE_CMDE", "CODE_PDV_FOURN", "I_PDV", "NUMERO_CMDE", "TYPE_CMDE", "DATE_LIVRAISON_CMDE",
    "CODE_ERP1_FOURN", "ENVOYEE_CMDE", "DATE_ENVOI_CMDE", "EMAIL_CMDES_FOURN", "LIBELLE_SITE",
    "ADRESSE_SITE", "TELEPHONE_SITE", "ADRESSE_LIVRAISON", "NOM_UTILISATEUR", "PRENOM_UTILISATEUR",
    "CODE_FOURN", "RAISON_SOCIALE_FOURN", "DATE_CMDE", "TOTAL_CMDE", "I_GLN_PDV",
    "I_GLN_DESTINATAIRE_DE_CMDE"
};
final String[] CHAMPS_LIGNE = {
    "CODE_ARTICLE_FOURN_CMDE", "CODE_ERP1_ARTICLE", "QUANTITE_ARTICLE_CMDE", "TARIF_ARTICLE_CMDE",
    "CODE_ERP1_UNITE_CONSOMMATION", "LIBELLE_FAMILLE", "LIBELLE_ARTICLE_CMDE", "LIBELLE_UNITE_ACHAT",
    "TOTAL_ARTICLE_CMDE", "CODE_ARTICLE", "PRIX_VENTE_ARTICLE_CMDE", "PCB_ARTICLE_CMDE",
    "I_LIGNE_CMDE", "I_EAN", "N_MULTIPLE_COMMANDE", "I_OPERATION", "L_OPERATION"
};
java.util.Map<String, String[]> entetes = new java.util.LinkedHashMap<String, String[]>();
java.util.Map<String, java.util.List<String[]>> lignesParCmde = new java.util.LinkedHashMap<String, java.util.List<String[]>>();
int nbLignesLues = 0;
