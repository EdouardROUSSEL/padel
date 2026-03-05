import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FFT_PADEL_FILE = path.join(DATA_DIR, "raw", "fft-padel.json");
const OUTPUT_FILE = path.join(DATA_DIR, "raw", "fft-padel-enriched.json");
const STATUS_FILE = path.join(DATA_DIR, "fft-enrich-status.json");

const COOKIE =
  "dtCookie=v_4_srv_17_sn_841C6A861123EFF2A1805A76AED4D815_perc_100000_ol_0_mul_1_app-3A2250bc529529d819_0_rcs-3Acss_0; i18n_redirected=fr; pa_privacy=%22optin%22; TCID=; TCPID=1263410413610433130829; QueueITAccepted-SDFrts345E-V3_tenupprod=EventId%3Dtenupprod%26RedirectType%3Dsafetynet%26IssueTime%3D1772703698%26Hash%3D801304525e7446c2d4ab83ee3bceb99a554db72fad9845ce9612a0adce6bb1da";

const DELAY_MS = 300;
const SAVE_EVERY = 20;

interface Court {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  source: string[];
  pratiques: string[];
  codeClub: string;
}

interface Status {
  total: number;
  enriched: number;
  failed: number;
  failedCodes: string[];
  enrichedCodes: string[];
}

async function loadStatus(): Promise<Status> {
  try {
    const data = await readFile(STATUS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { total: 0, enriched: 0, failed: 0, failedCodes: [], enrichedCodes: [] };
  }
}

async function saveStatus(status: Status): Promise<void> {
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function fetchClubPage(codeClub: string): Promise<{ lat: number; lng: number; address: string; postalCode: string } | null> {
  const url = `https://tenup.fft.fr/club/${codeClub}`;

  try {
    const response = await fetch(url, {
      headers: {
        Cookie: COOKIE,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });

    // If redirected to Queue-it, cookie expired
    if (response.status === 302) {
      const location = response.headers.get("location") || "";
      if (location.includes("queue-it")) {
        console.error("Cookie expired! Queue-it redirect detected.");
        process.exit(1);
      }
    }

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract coordinates from Google Maps link
    const coordsMatch = html.match(/destination=([-\d.]+),([-\d.]+)/);
    if (!coordsMatch) {
      return null;
    }

    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);

    // Extract address from the maps link text
    // Pattern: the address text is between the <a> tag containing the maps link
    const addressMatch = html.match(/<a[^>]*maps[^>]*>([^<]+)<\/a>/);
    let address = "";
    let postalCode = "";

    if (addressMatch) {
      const rawAddress = addressMatch[1].trim();
      // Try to extract postal code (5 digits)
      const cpMatch = rawAddress.match(/(\d{5})/);
      if (cpMatch) {
        postalCode = cpMatch[1];
        // Address is everything before the postal code
        address = rawAddress.substring(0, rawAddress.indexOf(cpMatch[1])).trim();
      } else {
        address = rawAddress;
      }
    }

    return { lat, lng, address, postalCode };
  } catch (error) {
    console.error(`Error fetching ${codeClub}:`, error);
    return null;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Load enriched file if it exists, otherwise start from raw
  let fftData;
  try {
    fftData = JSON.parse(await readFile(OUTPUT_FILE, "utf-8"));
    console.log("Resuming from enriched file");
  } catch {
    fftData = JSON.parse(await readFile(FFT_PADEL_FILE, "utf-8"));
    console.log("Starting from raw file");
  }
  const courts: Court[] = fftData.courts;

  console.log(`Total clubs to enrich: ${courts.length}`);

  // Load progress
  const status = await loadStatus();
  status.total = courts.length;

  const alreadyDone = new Set([...status.enrichedCodes, ...status.failedCodes]);
  console.log(`Already processed: ${alreadyDone.size} (${status.enriched} enriched, ${status.failed} failed)`);

  let processed = 0;

  for (const court of courts) {
    if (alreadyDone.has(court.codeClub)) continue;

    const result = await fetchClubPage(court.codeClub);

    if (result) {
      court.lat = result.lat;
      court.lng = result.lng;
      if (result.address) court.address = result.address;
      if (result.postalCode) court.postalCode = result.postalCode;
      status.enriched++;
      status.enrichedCodes.push(court.codeClub);
    } else {
      status.failed++;
      status.failedCodes.push(court.codeClub);
    }

    processed++;
    const total = courts.length - alreadyDone.size;
    const pct = ((processed / total) * 100).toFixed(1);
    console.log(
      `[${processed}/${total}] ${pct}% | ${court.codeClub} ${court.name} | ${result ? `✓ ${result.lat},${result.lng}` : "✗ FAILED"}`
    );

    // Save periodically
    if (processed % SAVE_EVERY === 0) {
      await saveStatus(status);
      // Update courts in the output file
      fftData.courts = courts;
      fftData.enrichedAt = new Date().toISOString();
      await writeFile(OUTPUT_FILE, JSON.stringify(fftData, null, 2));
    }

    await delay(DELAY_MS);
  }

  // Final save
  await saveStatus(status);
  fftData.courts = courts;
  fftData.enrichedAt = new Date().toISOString();
  await writeFile(OUTPUT_FILE, JSON.stringify(fftData, null, 2));

  const withCoords = courts.filter((c) => c.lat !== 0 && c.lng !== 0);
  console.log("");
  console.log(`Done!`);
  console.log(`  Enriched: ${status.enriched}`);
  console.log(`  Failed: ${status.failed}`);
  console.log(`  Total with coords: ${withCoords.length}/${courts.length}`);
}

main().catch(console.error);
