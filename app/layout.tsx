import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const inter=localFont({src:[{path:'./fonts/inter.woff2',weight:'400'},{path:'./fonts/inter-semibold.woff2',weight:'600'}],variable:'--font-inter'});
const barlow=localFont({src:'./fonts/barlow.woff2',weight:'600',variable:'--font-barlow'});
const mono=localFont({src:'./fonts/mono.woff2',weight:'400',variable:'--font-plex'});
export const metadata:Metadata={title:'Reservas Barbería · Agenda',description:'Organiza los turnos, horarios y disponibilidad de tu barbería.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body className={`${inter.variable} ${barlow.variable} ${mono.variable}`}>{children}</body></html>;}
