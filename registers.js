// =====================================================================
// MODBUS REGISTER MAP  -  EDIT THIS FILE if your device docs differ.
// addr  = register address exactly as sent on the wire (decimal or 0x hex)
// type  = u16 | i16 | f32 | i64      scale = multiplier applied to raw value
// Addresses are taken from the dashboard's own Modbus map / Termux script.
// VERIFY them against the Megarevo MPS and Schneider PM5xxx manuals.
// =====================================================================
module.exports = {
  inverters: {
    slaves: [1, 2, 3, 4],                       // Megarevo MPS #1..#4
    blocks: [{ start: 0x3000, count: 0x31 }],   // one read covers 0x3000..0x3030
    fields: {
      stateRaw:     { addr: 0x3000, type: 'u16' },             // 0=Standby 1=OnGrid 2=OffGrid 3=Fault
      pv1V:         { addr: 0x3004, type: 'u16', scale: 0.1 },
      pv1A:         { addr: 0x3005, type: 'u16', scale: 0.1 },
      pv1Kw:        { addr: 0x3006, type: 'u16', scale: 0.1 },
      pv2V:         { addr: 0x3007, type: 'u16', scale: 0.1 },
      pv2A:         { addr: 0x3008, type: 'u16', scale: 0.1 },
      pv2Kw:        { addr: 0x3009, type: 'u16', scale: 0.1 },
      batV:         { addr: 0x3010, type: 'u16', scale: 0.1 },
      batA:         { addr: 0x3011, type: 'i16', scale: 0.1 },
      batKw:        { addr: 0x3012, type: 'i16', scale: 0.1 },
      soc:          { addr: 0x3013, type: 'u16', scale: 1 },
      soh:          { addr: 0x3014, type: 'u16', scale: 1 },
      invVL1:       { addr: 0x3020, type: 'u16', scale: 0.1 },
      invVL2:       { addr: 0x3021, type: 'u16', scale: 0.1 },
      invVL3:       { addr: 0x3022, type: 'u16', scale: 0.1 },
      invIL1:       { addr: 0x3023, type: 'u16', scale: 0.1 },
      invIL2:       { addr: 0x3024, type: 'u16', scale: 0.1 },
      invIL3:       { addr: 0x3025, type: 'u16', scale: 0.1 },
      activeKw:     { addr: 0x3026, type: 'i16', scale: 0.1 },
      reactiveKvar: { addr: 0x3028, type: 'i16', scale: 0.1 },
      heatsinkTemp: { addr: 0x3030, type: 'u16', scale: 0.1 }
    }
  },
  meters: {
    slaves: [11, 12, 13, 14],                   // TX1, TX2, GEN1, GEN2
    blocks: [
      { start: 3000, count: 12 },
      { start: 3020, count: 18 },
      { start: 3054, count: 32 },
      { start: 3110, count: 2 },
      { start: 3204, count: 4 }
    ],
    fields: {
      iL1:   { addr: 3000, type: 'f32' }, iL2: { addr: 3002, type: 'f32' },
      iL3:   { addr: 3004, type: 'f32' }, iN:  { addr: 3006, type: 'f32' },
      iAvg:  { addr: 3010, type: 'f32' },
      vL12:  { addr: 3020, type: 'f32' }, vL23: { addr: 3022, type: 'f32' },
      vL31:  { addr: 3024, type: 'f32' }, vLLAvg: { addr: 3026, type: 'f32' },
      vL1N:  { addr: 3028, type: 'f32' }, vL2N: { addr: 3030, type: 'f32' },
      vL3N:  { addr: 3032, type: 'f32' }, vLNAvg: { addr: 3036, type: 'f32' },
      kwL1:  { addr: 3054, type: 'f32' }, kwL2: { addr: 3056, type: 'f32' },
      kwL3:  { addr: 3058, type: 'f32' }, kwTotal: { addr: 3060, type: 'f32' },
      kvarTotal: { addr: 3068, type: 'f32' },
      kvaTotal:  { addr: 3076, type: 'f32' },
      pfTotal:   { addr: 3084, type: 'f32' },
      freq:      { addr: 3110, type: 'f32' },
      energyImport: { addr: 3204, type: 'i64', scale: 0.001 }   // Wh -> kWh
    }
  }
};
