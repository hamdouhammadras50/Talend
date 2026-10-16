# S4_AffectationGerantCourant – attributs locaux (ticket 52654)

Procédure source : `usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4.sql`

## Ce qui change par rapport à la requête initiale

| Point | Avant | Après |
|---|---|---|
| Gérant | `b.dateFin = '9999-12-31'` → renvoie le gérant **futur** s'il existe une affectation à venir | `dateDebut <= date du jour <= dateFin` + `ROW_NUMBER()` → gérant **en poste** le jour du traitement |
| Jour de bascule (fin de l'un = début de l'autre) | – | on prend l'affectation commencée le plus récemment |
| Surfaces | valeur brute (ou `FORMAT(...,'N2','fr-FR')` en commentaire, qui renvoie du texte) | `DECIMAL(18,2)` arrondi à 2 décimales |
| PDV sans gérant en poste | exclu (`INNER JOIN`) | remonté avec CodeGerant / DateDebAffectation vides (`LEFT JOIN`) – validé par Nicolas |
| Date de référence | – | date locale (Paris), pas UTC – validé par Nicolas |
| CreatedAtUtc | absent | une seule valeur pour tout le lot (paramètre Talend, sinon `SYSUTCDATETIME()` calculé une fois) |

Cas de test du ticket (PDV 1LAA, traitement le 16/10/2026) :
- 00000001 du 01/02/2025 au 31/10/2026 → **retenu**
- 00000002 du 31/10/2026 au 31/12/9999 → ignoré jusqu'au 31/10/2026

## Job Talend (quotidien, full, sans commit intermédiaire)

1. `tPreJob` → `tSetGlobalVar` : `CREATED_AT_UTC` = date de lancement en UTC  
   `TalendDate.formatDateInUTC("yyyy-MM-dd HH:mm:ss", TalendDate.getCurrentDate())`
2. `tDBConnection` (S4) – **Auto Commit décoché**.
3. `tDBRow` (connexion existante) : `DELETE FROM S4_AffectationGerantCourant` (ou `TRUNCATE`, transactionnel sous SQL Server).
4. `tDBInput` (base Icare) :  
   `"EXEC dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4 @CreatedAtUtc = '" + globalMap.get("CREATED_AT_UTC") + "'"`
5. `tMap` → `tDBOutput` (connexion existante S4, action *Insert*). Comme la connexion est partagée, le composant ne commite pas : pas de commit intermédiaire.
6. `OnSubjobOk` → `tDBCommit` ; `OnSubjobError` / `tPostJob` en erreur → `tDBRollback`.  
   En cas d'échec, la table S4 garde le lot de la veille.

Travailler sur la base de **recette Icare** pour les tests.
