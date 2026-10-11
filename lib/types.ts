export type Barber={id:number;name:string;active:number};
export type Service=Barber & {duration:number};
export type Hours={id:number;barber_id:number;weekday:number;start:string;end:string};
export type Block={id:number;barber_id:number;start:number;end:number;reason:string};
export type Appointment={id:number;client_id:number;client_name:string;phone:string;service_id:number;barber_id:number;barber_name:string;service_name:string;start:number;end:number;duration:number;notes:string;status:'reservado'|'completado'|'cancelado'};
export type Settings={timezone:string;barbers:Barber[];services:Service[];hours:Hours[];blocks:Block[]};
export type Agenda=Settings & {date:string;appointments:Appointment[]};
