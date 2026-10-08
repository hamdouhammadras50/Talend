// Nom du fichier XML du jour, utilise par tAdvancedFileOutputXML et tFTPPut
String nomFichier = context.FILE_PREFIX
    + new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date()) + ".xml";
globalMap.put("EDICOM_FILE_NAME", nomFichier);
globalMap.put("EDICOM_FILE_PATH", context.OUTPUT_DIR + "/" + nomFichier);
