nbLignesLues++;
String cleCmde = row1.CODE_CMDE;
if (!entetes.containsKey(cleCmde)) {
    entetes.put(cleCmde, new String[] {
        row1.CODE_CMDE, row1.CODE_PDV_FOURN, row1.I_PDV, row1.NUMERO_CMDE, row1.TYPE_CMDE,
        row1.DATE_LIVRAISON_CMDE, row1.CODE_ERP1_FOURN, row1.ENVOYEE_CMDE, row1.DATE_ENVOI_CMDE,
        row1.EMAIL_CMDES_FOURN, row1.LIBELLE_SITE, row1.ADRESSE_SITE, row1.TELEPHONE_SITE,
        row1.ADRESSE_LIVRAISON, row1.NOM_UTILISATEUR, row1.PRENOM_UTILISATEUR, row1.CODE_FOURN,
        row1.RAISON_SOCIALE_FOURN, row1.DATE_CMDE, row1.TOTAL_CMDE, row1.I_GLN_PDV,
        row1.I_GLN_DESTINATAIRE_DE_CMDE
    });
    lignesParCmde.put(cleCmde, new java.util.ArrayList<String[]>());
}
lignesParCmde.get(cleCmde).add(new String[] {
    row1.CODE_ARTICLE_FOURN_CMDE, row1.CODE_ERP1_ARTICLE, row1.QUANTITE_ARTICLE_CMDE,
    row1.TARIF_ARTICLE_CMDE, row1.CODE_ERP1_UNITE_CONSOMMATION, row1.LIBELLE_FAMILLE,
    row1.LIBELLE_ARTICLE_CMDE, row1.LIBELLE_UNITE_ACHAT, row1.TOTAL_ARTICLE_CMDE, row1.CODE_ARTICLE,
    row1.PRIX_VENTE_ARTICLE_CMDE, row1.PCB_ARTICLE_CMDE, row1.I_LIGNE_CMDE, row1.I_EAN,
    row1.N_MULTIPLE_COMMANDE, row1.I_OPERATION, row1.L_OPERATION
});
