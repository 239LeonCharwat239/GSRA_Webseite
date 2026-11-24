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
};

export type Sitzung = {
  strecke: string | null;
  streckenlaengeM: number | null;
  fahrzeug: string | null;
  sitzungsart: string | null;
};

export type Status = {
  simulation: string;
  verbunden: boolean;
  meldung: string | null;
  sitzung: Sitzung | null;
};
