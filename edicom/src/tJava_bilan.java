Integer nbCmdes = (Integer) globalMap.get("EDICOM_NB_CMDES");
System.out.println("[EDICOM] Bilan : " + nbCmdes + " commande(s), "
    + globalMap.get("EDICOM_NB_LIGNES") + " ligne(s), fichier = " + globalMap.get("EDICOM_FILE_PATH")
    + ", envoi SFTP = " + (context.SFTP_ACTIVE && nbCmdes != null && nbCmdes > 0));
