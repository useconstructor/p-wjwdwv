import { Temporal } from '@js-temporal/polyfill';
export function instant(date:string,time:string,zone:string) {
 try { return Temporal.ZonedDateTime.from(`${date}T${time}:00[${zone}]`,{disambiguation:'reject'}).epochMilliseconds; }
 catch { throw new Error('La fecha u hora es inválida, inexistente o ambigua en esta zona horaria.'); }
}
export function local(ms:number,zone:string) { return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone); }
export function dayRange(date:string,zone:string) {
 const d=Temporal.PlainDate.from(date); return [d.toZonedDateTime(zone).epochMilliseconds,d.add({days:1}).toZonedDateTime(zone).epochMilliseconds];
}
export function today(zone:string) {return Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString();}
