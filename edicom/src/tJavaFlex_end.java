globalMap.put("EDICOM_NB_CMDES", entetes.size());
globalMap.put("EDICOM_NB_LIGNES", nbLignesLues);
globalMap.put("EDICOM_FILE_NAME", null);
globalMap.put("EDICOM_FILE_PATH", null);

if (entetes.isEmpty()) {
    System.out.println("[EDICOM] Aucune commande a envoyer : pas de fichier genere.");
} else {
    String nomFichier = context.FILE_PREFIX
        + new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date()) + ".xml";
    java.io.File dossier = new java.io.File(context.OUTPUT_DIR);
    if (!dossier.exists() && !dossier.mkdirs()) {
        throw new RuntimeException("Impossible de creer le dossier " + dossier.getAbsolutePath());
    }
    java.io.File fichier = new java.io.File(dossier, nomFichier);
    String nl = "\r\n";

    java.io.OutputStream os = new java.io.BufferedOutputStream(new java.io.FileOutputStream(fichier));
    try {
        javax.xml.stream.XMLStreamWriter xw =
            javax.xml.stream.XMLOutputFactory.newInstance().createXMLStreamWriter(os, "UTF-8");
        xw.writeStartDocument("UTF-8", "1.0");
        xw.writeCharacters(nl);
        xw.writeStartElement(context.XML_ROOT);
        for (java.util.Map.Entry<String, String[]> cmde : entetes.entrySet()) {
            xw.writeCharacters(nl + "  ");
            xw.writeStartElement("Commande");
            xw.writeCharacters(nl + "    ");
            xw.writeStartElement("Entete");
            String[] valeursEntete = cmde.getValue();
            for (int i = 0; i < CHAMPS_ENTETE.length; i++) {
                xw.writeCharacters(nl + "      ");
                xw.writeStartElement(CHAMPS_ENTETE[i]);
                xw.writeCharacters(valeursEntete[i] == null ? "" : valeursEntete[i]);
                xw.writeEndElement();
            }
            xw.writeCharacters(nl + "    ");
            xw.writeEndElement(); // Entete
            xw.writeCharacters(nl + "    ");
            xw.writeStartElement("Lignes");
            for (String[] valeursLigne : lignesParCmde.get(cmde.getKey())) {
                xw.writeCharacters(nl + "      ");
                xw.writeStartElement("Ligne");
                for (int i = 0; i < CHAMPS_LIGNE.length; i++) {
                    xw.writeCharacters(nl + "        ");
                    xw.writeStartElement(CHAMPS_LIGNE[i]);
                    xw.writeCharacters(valeursLigne[i] == null ? "" : valeursLigne[i]);
                    xw.writeEndElement();
                }
                xw.writeCharacters(nl + "      ");
                xw.writeEndElement(); // Ligne
            }
            xw.writeCharacters(nl + "    ");
            xw.writeEndElement(); // Lignes
            xw.writeCharacters(nl + "  ");
            xw.writeEndElement(); // Commande
        }
        xw.writeCharacters(nl);
        xw.writeEndElement(); // racine
        xw.writeCharacters(nl);
        xw.writeEndDocument();
        xw.flush();
        xw.close();
    } finally {
        os.close();
    }

    globalMap.put("EDICOM_FILE_NAME", nomFichier);
    globalMap.put("EDICOM_FILE_PATH", fichier.getAbsolutePath());
    System.out.println("[EDICOM] Fichier genere : " + fichier.getAbsolutePath()
        + " (" + entetes.size() + " commande(s), " + nbLignesLues + " ligne(s))");
}
