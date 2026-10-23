Integer nbLignes = (Integer) globalMap.get("tAdvancedFileOutputXML_1_NB_LINE");
if (nbLignes == null || nbLignes == 0) {
    System.out.println("[EDICOM] Aucune commande a envoyer : pas de fichier genere.");
} else {
    System.out.println("[EDICOM] Fichier genere : " + globalMap.get("EDICOM_FILE_PATH")
        + " (" + nbLignes + " ligne(s) de commande), envoi SFTP = " + context.SFTP_ACTIVE);
}
