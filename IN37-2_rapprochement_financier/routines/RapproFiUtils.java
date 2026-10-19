package routines;

import java.math.BigDecimal;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;

/*
 * Routine Talend - IN37-2 / IT-19934 Rapprochement financier.
 * À créer dans Repository > Code > Routines > RapproFiUtils.
 */
public class RapproFiUtils {

    /**
     * Clé unique pièce comptable : RBUKRS "-" GJAHR "-" BELNR.
     *
     * {talendTypes} String
     * {Category} RapproFi
     * {example} idRapproFiAx("FR01", "2026", "0100000123") # FR01-2026-0100000123
     */
    public static String idRapproFiAx(String bukrs, String gjahr, String belnr) {
        return trim(bukrs) + "-" + trim(gjahr) + "-" + trim(belnr);
    }

    /**
     * Montant débit : HSL si HSL > 0, sinon null.
     *
     * {talendTypes} BigDecimal
     * {Category} RapproFi
     */
    public static BigDecimal debit(BigDecimal hsl) {
        return (hsl != null && hsl.signum() > 0) ? hsl : null;
    }

    /**
     * Montant crédit : |HSL| si HSL < 0, sinon null.
     * (signe à confirmer avec LTRF : valeur absolue ou montant négatif)
     *
     * {talendTypes} BigDecimal
     * {Category} RapproFi
     */
    public static BigDecimal credit(BigDecimal hsl) {
        return (hsl != null && hsl.signum() < 0) ? hsl.abs() : null;
    }

    /**
     * Mode de paiement : XREF2 du 5ème au 7ème caractère (pièces RB).
     *
     * {talendTypes} String
     * {Category} RapproFi
     */
    public static String modePaiement(String xref2) {
        if (xref2 == null || xref2.length() < 5) {
            return null;
        }
        return xref2.substring(4, Math.min(7, xref2.length())).trim();
    }

    /**
     * I_AGENT : XREF3, alimenté uniquement pour les types RB (et "EC" selon la spec).
     *
     * {talendTypes} String
     * {Category} RapproFi
     */
    public static String agent(String blart, String xref3) {
        if ("RB".equals(blart) || "EC".equals(blart)) {
            return xref3 == null ? null : left(xref3.trim(), 6);
        }
        return null;
    }

    /**
     * Convertit un timestamp SAP DEC(15) AAAAMMJJhhmmss en Date.
     *
     * {talendTypes} Date
     * {Category} RapproFi
     */
    public static Date sapTimestampToDate(Object ts) {
        if (ts == null) {
            return null;
        }
        String s = new BigDecimal(ts.toString()).toPlainString();
        if (s.length() < 14 || s.startsWith("0")) {
            return null;
        }
        return parse("yyyyMMddHHmmss", s.substring(0, 14));
    }

    /**
     * Convertit une date SAP DATS (AAAAMMJJ) en Date ; "00000000" ou vide -> null.
     *
     * {talendTypes} Date
     * {Category} RapproFi
     */
    public static Date sapDate(String dats) {
        if (dats == null || dats.trim().isEmpty() || "00000000".equals(dats)) {
            return null;
        }
        return parse("yyyyMMdd", dats.trim());
    }

    /**
     * RG00 : date limite de réponse DIF = BUDAT + délai (jours).
     *
     * {talendTypes} Date
     * {Category} RapproFi
     */
    public static Date dateLimiteDif(Date budat, int delaiJours) {
        if (budat == null) {
            return null;
        }
        Calendar c = Calendar.getInstance();
        c.setTime(budat);
        c.add(Calendar.DAY_OF_MONTH, delaiJours);
        return c.getTime();
    }

    /**
     * Timestamp SAP courant (UTC) au format AAAAMMJJhhmmss.
     *
     * {talendTypes} Long
     * {Category} RapproFi
     */
    public static Long nowSapTimestampUtc() {
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmmss");
        f.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return Long.valueOf(f.format(new Date()));
    }

    private static Date parse(String pattern, String value) {
        try {
            SimpleDateFormat f = new SimpleDateFormat(pattern);
            f.setLenient(false);
            return f.parse(value);
        } catch (ParseException e) {
            return null;
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String left(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n);
    }
}
