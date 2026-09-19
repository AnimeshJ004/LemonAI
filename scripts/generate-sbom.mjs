import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Generates an SPDX-compliant Software Bill of Materials (SBOM) in JSON format
 * directly from package.json and package-lock.json.
 */
function generateSBOM() {
  const rootDir = process.cwd();
  const pkgPath = path.join(rootDir, "package.json");
  const lockPath = path.join(rootDir, "package-lock.json");

  if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath)) {
    console.error("Error: package.json or package-lock.json not found.");
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));

  const timestamp = new Date().toISOString();
  const documentNamespace = `https://lemon-ai.com/spdxdocs/${pkg.name}-${pkg.version}-${Date.now()}`;

  const packages = [
    {
      SPDXID: "SPDXRef-RootPackage",
      name: pkg.name || "lemon-ai",
      versionInfo: pkg.version || "1.0.0",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
      copyrightText: "NOASSERTION",
      description: "Root application package for Lemon AI",
    },
  ];

  const relationships = [];

  const lockPackages = lock.packages || {};
  let counter = 1;

  for (const [pkgKey, pkgData] of Object.entries(lockPackages)) {
    if (!pkgKey || pkgKey === "") continue; // skip root
    const cleanName = pkgKey.replace(/^node_modules\//, "");
    // Only capture top-level direct node_modules dependencies
    if (cleanName.includes("node_modules/")) continue;

    const spdxId = `SPDXRef-Package-${counter++}`;
    packages.push({
      SPDXID: spdxId,
      name: cleanName,
      versionInfo: pkgData.version || "unknown",
      downloadLocation: pkgData.resolved || "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: pkgData.license || "NOASSERTION",
      licenseDeclared: pkgData.license || "NOASSERTION",
      copyrightText: "NOASSERTION",
      checksums: pkgData.integrity
        ? [
            {
              algorithm: pkgData.integrity.startsWith("sha512-")
                ? "SHA512"
                : "SHA1",
              checksumValue: pkgData.integrity,
            },
          ]
        : [],
    });

    relationships.push({
      spdxElementId: "SPDXRef-RootPackage",
      relationshipType: "DEPENDS_ON",
      relatedSpdxElement: spdxId,
    });
  }

  const spdxDocument = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${pkg.name}-sbom`,
    documentNamespace,
    creationInfo: {
      creators: ["Tool: LemonAI-SBOM-Generator-1.0", "Organization: Lemon AI"],
      created: timestamp,
    },
    packages,
    relationships,
  };

  const outputPath = path.join(rootDir, "sbom.spdx.json");
  fs.writeFileSync(outputPath, JSON.stringify(spdxDocument, null, 2), "utf-8");
  console.log(`[SBOM] ✓ Successfully generated SPDX SBOM with ${packages.length} packages at ${outputPath}`);
}

generateSBOM();
