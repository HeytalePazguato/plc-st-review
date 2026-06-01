# HARDCODED_NETWORK_ENDPOINT

**Severity:** `warn`

A STRING-typed variable is initialised with a literal value that matches an IPv4 dotted-quad (with optional `:port`) or a URL with an ICS / OT scheme (`http(s)`, `tcp`, `udp`, `opc`, `opc.tcp`, `mqtt`, `mqtts`, `modbus`, `ssh`, `ftp`).

**Why it matters.** IEC 62443-4-1 SI-1: configuration data (including network endpoints) should not be hard-coded into the component. A literal IP or URL in source ties production behaviour to whichever environment the developer happened to be testing against — and when "test" endpoints reach prod, you get the kind of incident that triggers a CVE write-up. The component also becomes non-portable across deployments (dev / staging / prod) without a code change.

**Settings.** No check-specific config in v0.x. The loopback / unspecified addresses `127.0.0.1`, `0.0.0.0`, `::1`, and `localhost` are skipped by default (almost always intentional placeholders).

**Trigger.**

```pascal
VAR_GLOBAL
    sScadaHost  : STRING := '10.0.0.5';                          (* fires *)
    sOpcServer  : STRING := 'opc.tcp://server.local:4840';        (* fires *)
    sModbusGw   : STRING := 'modbus://192.168.1.100:502';         (* fires *)
    sLoopback   : STRING := '127.0.0.1';                         (* OK — allowlisted *)
END_VAR
```

**The bot posts.**

```
🟧 warn  HARDCODED_NETWORK_ENDPOINT
Hard-coded network IP address in 'sScadaHost' = '10.0.0.5' (IEC 62443-4-1 SI-1)
```

**Fix.** Move the endpoint to a configuration store (a `VAR CONFIG` block populated by the engineering tool, a parameter file loaded at startup) or accept it as a `VAR_INPUT` so the integrator can override per-deployment. If you need a default for development, gate the literal behind a build configuration that is off in production.
