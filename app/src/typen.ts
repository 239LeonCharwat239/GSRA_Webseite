// Datenformen zwischen Rust (gsra-telemetrie) und Oberfläche – Namen wie in Rust (camelCase)

/** Ein Messpunkt. Einheiten: Sekunden, Meter, m/s, U/min, Liter; Pedale 0…1; Lenkung im Bogenmaß */
export type Probe = {
  tick: number;
  zeit: number | null;
  runde: number | null;
  anteil: number | null;
  meter: number | null;
  tempo: number | null;
  drehzahl: number | null;
  gang: number | null;
  gas: number | null;
  bremse: number | null;
  lenkung: number | null;
  sprit: number | null;
  rundenzeit: number | null;
  letzteRunde: number | null;
  besteRunde: number | null;
  aufStrecke: boolean | null;
  inBox: boolean | null;
  /** Fahrtrichtung zur Nordrichtung (Bogenmaß, im Uhrzeigersinn) – daraus entsteht die Streckenkarte */
  richtung: number | null;
  /** Spotter (iRacing CarLeftRight): 0 aus, 1 frei, 2 links, 3 rechts, 4 beidseitig, 5 zwei links, 6 zwei rechts */
  seite?: number | null;
  /** Schaden: anstehende Pflicht- bzw. optionale Reparatur in Sekunden (0 = keine) */
  reparatur?: number | null;
  reparaturOptional?: number | null;
  /** Beschleunigung quer / längs in m/s² (Crash-Erkennung) */
  querBeschl?: number | null;
  laengsBeschl?: number | null;
  /** eigene Vorfallpunkte der Sitzung */
  vorfaelle?: number | null;
  /** Lage: -1 nicht im Auto, 0 neben der Strecke, 1 Box-Platz, 2 Boxeneinfahrt, 3 Strecke */
  lage?: number | null;
  /** Flaggen (Bitfeld; 0x100000 = Fleischball) */
  flaggen?: number | null;
  /** Motor-Warnungen (Bitfeld: 1 Wasser, 2 Benzindruck, 4 Öldruck, 8 abgewürgt, 0x40 Öltemperatur) */
  motorWarnung?: number | null;
};

export type FahrerInfo = {
  idx: number; name: string; nummer: string;
  /** Auto des Fahrers (fehlt bei älteren Ständen) */
  fahrzeug?: string;
  /** iRating, Lizenz mit Safety Rating („A 4.99“), Vorfallpunkte („X“) – Wunsch 28.11. */
  irating?: number | null; lizenz?: string; vorfaelle?: number | null;
};

export type Sitzung = {
  strecke: string | null;
  streckenlaengeM: number | null;
  fahrzeug: string | null;
  sitzungsart: string | null;
  /** Teilnehmer (ohne Pace-Car und Zuschauer); fehlt bei älteren Ständen */
  fahrer?: FahrerInfo[];
};

/** Stand aller Autos (Index = Auto im Feld der Simulation); viermal pro Sekunde */
export type Feld = {
  zeit: number | null;
  ich: number | null;
  /** Streckenanteil 0…1, negativ = Auto nicht auf der Strecke */
  anteil: Array<number | null>;
  runde: Array<number | null>;
  platz: Array<number | null>;
  inBox: Array<number | null>;
  /** letzte und beste Rundenzeit je Auto (Sekunden; ≤ 0 = noch keine) – fehlt bei älteren Ständen */
  letzte?: Array<number | null>;
  beste?: Array<number | null>;
  /** Flaggen je Auto (Strafe, Verwarnung, Fleischball) – fehlt bei älteren Ständen */
  flaggen?: Array<number | null>;
};

export type Status = {
  simulation: string;
  verbunden: boolean;
  meldung: string | null;
  sitzung: Sitzung | null;
};
