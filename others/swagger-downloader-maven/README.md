# Swagger Downloader for Java/Maven Projects

Cross-platform solution to download a Swagger file from GitLab.
Works on Mac, Linux, and Windows. Replaces the shell script approach used in React projects.

## Prerequisites

1. Create a `.env` file in your Java project root:
```properties
PERSONAL_TOKEN=your_gitlab_personal_access_token
```

2. Place your GitLab certificate at `certs/gitlab.res.sys.shared.fortis.pem` in your project root.

---

## Option 1: Maven Download Plugin

Simple approach. Does **not** support custom CA certificates.

### pom.xml profile

Add this inside `<profiles>` in your `pom.xml`:

```xml
<profile>
    <id>update-swagger</id>
    <build>
        <plugins>
            <plugin>
                <groupId>com.googlecode.maven-download-plugin</groupId>
                <artifactId>download-maven-plugin</artifactId>
                <version>1.9.0</version>
                <executions>
                    <execution>
                        <id>download-swagger</id>
                        <phase>generate-sources</phase>
                        <goals>
                            <goal>wget</goal>
                        </goals>
                        <configuration>
                            <url>https://gitlab.res.sys.shared.fortis/fortis/apps/IDPX/catalog/apis/mortgage-loan-simulation-front-1.0/-/raw/main/swagger.yaml?ref_type=heads</url>
                            <outputDirectory>${project.basedir}/src/api/swagger</outputDirectory>
                            <outputFileName>mortgage-simulation.yml</outputFileName>
                            <headers>
                                <PRIVATE-TOKEN>${env.PERSONAL_TOKEN}</PRIVATE-TOKEN>
                            </headers>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</profile>
```

### Run

```bash
# Mac/Linux
PERSONAL_TOKEN=your_token mvn generate-sources -Pupdate-swagger

# Windows (cmd)
set PERSONAL_TOKEN=your_token
mvn generate-sources -Pupdate-swagger

# Windows (PowerShell)
$env:PERSONAL_TOKEN="your_token"; mvn generate-sources -Pupdate-swagger
```

---

## Option 2: Java Downloader + Exec Plugin

Handles custom CA certificates. Recommended for corporate GitLab.

### Step 1: Add the Java class

Copy `SwaggerDownloader.java` (included in this folder) to `src/main/java/tools/SwaggerDownloader.java` in your project.

### Step 2: Add the pom.xml profile

Add this inside `<profiles>` in your `pom.xml`:

```xml
<profile>
    <id>update-swagger</id>
    <build>
        <plugins>
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>exec-maven-plugin</artifactId>
                <version>3.1.0</version>
                <executions>
                    <execution>
                        <id>download-swagger</id>
                        <phase>generate-sources</phase>
                        <goals>
                            <goal>java</goal>
                        </goals>
                        <configuration>
                            <mainClass>tools.SwaggerDownloader</mainClass>
                            <arguments>
                                <argument>${project.basedir}</argument>
                            </arguments>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</profile>
```

### Run

```bash
mvn generate-sources -Pupdate-swagger
```

---

## Customization

Update these values to match your project:

| Value | Option 1 | Option 2 |
|---|---|---|
| GitLab URL | In pom profile XML | `GITLAB_URL` in SwaggerDownloader.java |
| Output path | In pom profile XML | `DEST_RELATIVE_PATH` in SwaggerDownloader.java |
| Cert path | N/A | `CERT_RELATIVE_PATH` in SwaggerDownloader.java |

## Comparison with shell script

| Shell script | Maven equivalent |
|---|---|
| `bash scripts/update_swagger.sh` | `mvn generate-sources -Pupdate-swagger` |
| Reads `.env` manually | Reads `.env` via Java Properties / env var |
| Uses `curl` with `--cacert` | Uses Java HttpsURLConnection with custom SSLContext |
| Mac/Linux only | Mac, Linux, and Windows |
