# Neighborhood Emergency Network

Offline hazard-alert relay between nearby Android phones, built into the CivicPulse mobile app.
It is an **alert** system, not chat: fixed categories, a short bounded description, no inbox.

## Status (read this first)

| Claim | State |
|---|---|
| Native build compiles with `expo-nearby-connections` 1.1.1 + `react-native-nitro-modules` 0.37.1 on Expo 57 / RN 0.86 | **Verified** (release APK built, native libs present) |
| Protocol, storage, dedupe, expiry, hop limit, retry, consent, rate limits | **Verified in automated tests** (46 tests, real SQLite engine, simulated radios) |
| Two physical phones exchange an alert with internet off | **NOT YET TESTED on hardware.** Run the checklist below |
| Alert relayed A to B to C across three phones | **Passes in simulation only. NOT validated on hardware. Do not claim it.** |
| Notifications, permission prompts and radio-off states on real Android versions | **NOT YET TESTED** |
| Server upload (`/api/mesh/ingest`) and a `server_confirmed` state | **Future work. Not implemented.** The app never shows server delivery. |
| Background / app-closed operation | **Out of scope.** Foreground, user-started session only |
| iOS | **Not supported.** Android only; no Android-to-iOS interop is claimed |

## Setup

Expo Go **cannot** run this feature (custom native code). Use a development or release build.

```bash
cd mobile
bun install
npx expo prebuild --platform android      # regenerates android/ (gitignored)
```

Build with Android Studio's bundled JDK 21 (the system JDK 25 is too new for Gradle):

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk
```

Use a **release** build for the offline test: a debug build needs Metro over the network.
The APK is signed with the debug keystore: fine for a demo, not for the Play Store.

### Local patch to the library
`expo-nearby-connections@1.1.1` ships an `android/build.gradle` that runs
`apply from: './fix-prefab.gradle'`, but the published package does not contain that file.
`patches/expo-nearby-connections@1.1.1.patch` (applied by `bun install`) adds it, copied from
`react-native-nitro-modules`. Remove the patch if a later release fixes this.

## Permissions

Declared by the library's config plugin and requested at runtime from **Turn relay on**
(`lib/mesh/permissions.ts`):

| Android | Runtime permissions |
|---|---|
| 13+ | `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `NEARBY_WIFI_DEVICES`, `POST_NOTIFICATIONS` |
| 12 | the three `BLUETOOTH_*` and `ACCESS_FINE_LOCATION` |
| 11 and below | `ACCESS_FINE_LOCATION`, and the system Location switch must be on |

This per-version table follows Google's Nearby Connections documentation and has not been
confirmed on every version. The relay needs the Bluetooth and Wi-Fi **radios on**. It does not
need an internet connection.

## Architecture

```
app/emergency-network.tsx          screen
components/mesh/*                  status, consent prompts, alert feed, SOS and hazard sheets
hooks/useRelaySession.ts           React state + foreground lifecycle (stops 30 s after backgrounding)
lib/mesh/app-engine.ts             wires the engine to NearbyTransport, expo-crypto, notifications
lib/mesh/engine.ts, relay-*.ts     RelayEngine: links, inbound frames, send pump, user actions
lib/mesh/transport.ts              MeshTransport interface (the seam between radio and logic)
lib/mesh/transport.nearby.ts       adapter over expo-nearby-connections, Strategy.P2P_CLUSTER
lib/mesh/protocol, validate, alerts, frames    schema, validation, create/forward, wire frames
lib/mesh/store*.ts, outbox*.ts, db*.ts         SQLite persistence and the forwarding queue
lib/mesh/__tests__/                tests and a simulated radio network
```

### Library facts the design is built on (read from the package source)
- Advertising and discovery are separate calls on one shared client and service id, so one phone
  can do both with `Strategy.P2P_CLUSTER`. **Doing both at once is unconfirmed on hardware.**
- The dialling side auto-accepts; the advertising side gets an invitation and must call
  `acceptConnection`. A failed connection emits **no event**, so the relay times dials out itself.
- Payloads are bytes sent as text; Nearby caps a bytes payload near 32 KB. Frames are capped at 16 KB.
- `peerId` is a per-connection handle. Stable identity is a pseudonymous node id carried in the
  advertised name (`cp1-<16 hex>`), which is **unauthenticated**.
- `disconnect(id)` targets one endpoint on Android only.

## Protocol v1

Alert fields: `id` (UUID, unchanged along the whole relay chain), `schemaVersion`, `type`
(`sos|flood|fire|road_hazard|gas_leak`), `severity` (`advisory|warning|critical`), `source`
(always `community`), `originId` (opaque per-install pseudonym), `createdAt`, `expiresAt`,
optional `latitude`/`longitude`, `summary` (<= 140 chars), `hopCount`, `maxHops`, `integrity`.

Defaults (experimental, not emergency-response recommendations): 5 hops, 30-minute lifetime,
2 h maximum accepted, 1 KB per alert, 12 alerts per frame, 100-id inventory, 100 stored alerts.

On connect both phones send an **inventory** of alert ids and queue only what the other lacks.
Alerts go out in bounded batches with `hopCount + 1`. The receiver validates, **commits to SQLite,
then acknowledges**. Unacknowledged sends are retried and survive restarts.

### Trust model
`integrity` is a SHA-256 digest. It detects corruption and a relay editing an alert, but anyone
can recompute it, so it does **not** prove who created an alert. Every alert is therefore shown as
an **unverified community report**, and an alert claiming another source (such as "official") is
rejected. Authenticated origin needs asymmetric signatures with a published key: future work.
Nearby's link encryption protects only the hop to the immediate neighbour.

### Privacy
No names, phone numbers, account ids or device ids are sent. Location is included only when the
user turns it on (SOS: off by default). Peer labels derive from pseudonymous ids.

## Delivery vocabulary

| Label | Meaning |
|---|---|
| Saved here only | stored on this phone; no nearby phone has confirmed it |
| Waiting to send | queued for a connected phone |
| Confirmed by a nearby phone | that phone replied that it durably stored it |
| From a nearby phone | received on this phone |
| Expired | past its lifetime; never forwarded or notified |

Bytes accepted by the radio (`sent`) are never shown as delivery. There is no server-confirmed state.

## Two-phone device test

Fill in the Result column. Nothing here has been run on hardware yet.

Phones: ________   Android versions: ________   Build: release APK   Date: ________

| # | Test | Steps | Result |
|---|---|---|---|
| 1 | Direct offline alert | Turn airplane mode ON, then switch Bluetooth and Wi-Fi back ON on both phones. Open the screen on both, turn the relay on, tap Allow on each. Report a flood on A. | |
| 2 | One notification | B shows exactly one notification and one card. | |
| 3 | Honest state | A shows Confirmed by a nearby phone only after B has received it. | |
| 4 | Restart | Create an alert on A while B is off. Force-stop A, reopen it, turn the relay on, then start B. B receives it. | |
| 5 | No duplicates | Turn B relay off and on. B does not notify again. | |
| 6 | Expiry | After 30 minutes the card shows Expired and is not sent to a newly connected phone. | |
| 7 | Permission denied | Deny Nearby devices. A clear message and a Settings link appear. | |
| 8 | Radio off | Turn Bluetooth off, then try to start. A clear message appears. | |
| 9 | Block | Block a phone. It is never connected again. | |
| 10 | Server wording | No screen says delivered or sent to server. | |

## Known limitations

- Android only; both phones need Google Play services.
- Foreground only: keep the screen open (the relay stops 30 s after the app is backgrounded).
- Community reports only; not an official warning channel.
- Limits are fixed prototype values; the 30-minute lifetime is not a recommendation.
- Relaying beyond two phones is unproven on hardware.
