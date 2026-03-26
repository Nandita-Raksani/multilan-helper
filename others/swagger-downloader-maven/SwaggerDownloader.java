package tools;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.io.Reader;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.util.Properties;

/**
 * Cross-platform Swagger downloader for GitLab with custom certificate support.
 *
 * Place this file at: src/main/java/tools/SwaggerDownloader.java
 *
 * Run via: mvn generate-sources -Pupdate-swagger
 */
public class SwaggerDownloader {

    // ---- CONFIGURE THESE ----
    private static final String GITLAB_URL =
            "https://gitlab.res.sys.shared.fortis/fortis/apps/IDPX/catalog/apis/mortgage-loan-simulation-front-1.0/-/raw/main/swagger.yaml?ref_type=heads";
    private static final String CERT_RELATIVE_PATH = "certs/gitlab.res.sys.shared.fortis.pem";
    private static final String DEST_RELATIVE_PATH = "src/api/swagger/mortgage-simulation.yml";
    private static final String ENV_FILE_NAME = ".env";
    // -------------------------

    public static void main(String[] args) throws Exception {
        Path projectRoot = args.length > 0 ? Paths.get(args[0]) : Paths.get(".");

        // Load .env
        Path envPath = projectRoot.resolve(ENV_FILE_NAME);
        if (!Files.exists(envPath)) {
            System.err.println("ERROR: .env not found at " + envPath.toAbsolutePath());
            System.exit(1);
        }
        Properties env = new Properties();
        try (Reader r = Files.newBufferedReader(envPath)) {
            env.load(r);
        }

        // Verify token
        String token = env.getProperty("PERSONAL_TOKEN");
        if (token == null || token.isBlank()) {
            System.err.println("ERROR: PERSONAL_TOKEN not defined in .env");
            System.exit(1);
        }

        // Load custom certificate
        Path certPath = projectRoot.resolve(CERT_RELATIVE_PATH);
        if (!Files.exists(certPath)) {
            System.err.println("ERROR: Certificate not found at " + certPath.toAbsolutePath());
            System.exit(1);
        }

        KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
        keyStore.load(null, null);
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        try (InputStream certIn = Files.newInputStream(certPath)) {
            keyStore.setCertificateEntry("gitlab", cf.generateCertificate(certIn));
        }

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(keyStore);
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, tmf.getTrustManagers(), new java.security.SecureRandom());

        // Download swagger
        Path destFile = projectRoot.resolve(DEST_RELATIVE_PATH);
        Files.createDirectories(destFile.getParent());

        HttpsURLConnection conn = (HttpsURLConnection) new URL(GITLAB_URL).openConnection();
        conn.setSSLSocketFactory(sslContext.getSocketFactory());
        conn.setRequestProperty("PRIVATE-TOKEN", token);

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            System.err.println("ERROR: Download failed with HTTP " + responseCode);
            System.exit(1);
        }

        try (InputStream in = conn.getInputStream()) {
            Files.copy(in, destFile, StandardCopyOption.REPLACE_EXISTING);
        }

        System.out.println("Swagger downloaded to " + destFile.toAbsolutePath());
    }
}
