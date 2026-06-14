/**
 * Galerie de șabloane LP — pornești o pagină dintr-un model gata (blocuri + design + decor + formular)
 * în loc de la zero. Datele sunt statice (generate de un workflow de autorare); orice șablon trece
 * prin coerceToLandingPage la aplicare, deci e robust indiferent de conținut.
 */
import { coerceToLandingPage, type LandingPage } from '../types/landingPage';

export interface LpTemplate {
  id: string;
  name: string;
  category: string;
  lang: 'ro' | 'en';
  blocks: Array<{ type: string; props: Record<string, unknown> }>;
  design: Record<string, unknown>;
  pageDecor?: Record<string, unknown>;
  form?: Record<string, unknown>;
}

/** Construiește o LandingPage editabilă (mod vizual) dintr-un șablon — totul prin coerceToLandingPage. */
export function landingPageFromTemplate(tpl: LpTemplate, adminUid: string): LandingPage {
  return coerceToLandingPage({
    schema: 1,
    slug: '',
    title: tpl.name,
    seoDescription: '',
    status: 'draft',
    lang: tpl.lang,
    editor: 'visual',
    blocks: tpl.blocks,
    design: tpl.design,
    pageDecor: tpl.pageDecor || {},
    hasForm: tpl.form ? (tpl.form as { enabled?: boolean }).enabled === true : false,
    form: tpl.form || {},
    createdBy: adminUid,
  });
}

// Generat de workflow-ul author-lp-templates (2026-06-14). Vezi DEVLOG.
export const LP_TEMPLATES: LpTemplate[] = [
  {
    "id": "conferinta-business-summit-2026",
    "name": "Conferință Business",
    "category": "Eveniment / Înscriere",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "BUSINESS SUMMIT 2026 — Liderii care construiesc viitorul",
          "subheading": "O zi. 18 speakeri de top. 600 de antreprenori și directori. Pe 15 octombrie, la București, intri în camera unde se iau deciziile care contează.",
          "ctaText": "Rezervă-ți locul acum",
          "ctaHref": "#",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Speakeri de calibru internațional",
              "body": "Învață direct de la fondatori care au scalat companii de la zero la milioane de euro și de la directori din top 100 companii din România."
            },
            {
              "title": "Networking care deschide uși",
              "body": "600 de decidenți într-un singur loc. Conexiunile pe care le faci aici pot deveni următorul tău parteneriat, client sau investitor."
            },
            {
              "title": "Strategii aplicabile luni dimineață",
              "body": "Fără teorie inutilă. Pleci cu un plan concret de creștere, instrumente testate și idei pe care le poți implementa imediat."
            }
          ]
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "Agenda zilei — 15 octombrie, București",
          "level": "h2",
          "align": "center"
        }
      },
      {
        "type": "faq",
        "props": {
          "items": [
            {
              "q": "09:00 — Deschidere și Keynote",
              "a": "Înregistrare, cafea de networking și discursul de deschidere: „Cum arată leadershipul în următorul deceniu”."
            },
            {
              "q": "10:30 — Panel: Scalare și Finanțare",
              "a": "Fondatori și investitori dezbat cum atragi capital și cum crești sănătos, fără să pierzi controlul afacerii."
            },
            {
              "q": "13:00 — Prânz și Networking facilitat",
              "a": "Mese tematice pe industrii, ca să te conectezi exact cu oamenii relevanți pentru obiectivele tale."
            },
            {
              "q": "15:00 — Workshopuri practice",
              "a": "Sesiuni interactive pe vânzări, marketing și automatizare. Alegi traseul potrivit pentru tine."
            },
            {
              "q": "18:00 — Keynote final și Cocktail",
              "a": "Discursul de închidere, urmat de un cocktail premium, unde se leagă cele mai bune conexiuni ale zilei."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "Ediția trecută mi-a schimbat complet perspectiva asupra creșterii. Două dintre cele mai mari contracte din acest an au pornit de la oameni pe care i-am cunoscut aici. Merită fiecare leu.",
          "author": "Andreea Marin, CEO, NovaTech Solutions"
        }
      },
      {
        "type": "text",
        "props": {
          "text": "Locurile sunt limitate la 600 de participanți, iar tariful early-bird expiră pe 31 august. Anul trecut s-a făcut sold-out cu 3 săptămâni înainte de eveniment.",
          "align": "center"
        }
      },
      {
        "type": "form",
        "props": {
          "heading": "Înscrie-te la Business Summit 2026"
        }
      },
      {
        "type": "button",
        "props": {
          "text": "Vreau locul meu la Summit",
          "href": "#",
          "align": "center"
        }
      }
    ],
    "design": {
      "base": "midnight",
      "vars": {
        "bg-0": "#0a0e1a",
        "bg-1": "#121829",
        "fg-0": "#f4f6fb",
        "fg-1": "#aeb8d0",
        "border": "#26304a",
        "accent": "#f0b429",
        "accent-dark": "#c79212",
        "accent-contrast": "#0a0e1a"
      },
      "digital": true,
      "bgImage": "",
      "animation": "sheen",
      "headingFont": "montserrat",
      "bodyFont": "inter"
    },
    "pageDecor": {
      "effect": "constellation",
      "interaction": "mouseParallax",
      "density": 40,
      "speed": 18,
      "size": 3,
      "color": "#f0b429",
      "opacity": 0.32,
      "intensity": 45
    },
    "form": {
      "enabled": true,
      "fields": [
        {
          "name": "nume",
          "label": "Nume și prenume",
          "type": "text",
          "required": true,
          "options": []
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "required": true,
          "options": []
        },
        {
          "name": "telefon",
          "label": "Telefon",
          "type": "tel",
          "required": true,
          "options": []
        },
        {
          "name": "companie",
          "label": "Companie",
          "type": "text",
          "required": true,
          "options": []
        },
        {
          "name": "rol",
          "label": "Rolul tău",
          "type": "select",
          "required": false,
          "options": [
            "Fondator / CEO",
            "Director / Manager",
            "Antreprenor",
            "Specialist",
            "Altul"
          ]
        }
      ],
      "submitLabel": "Confirmă înscrierea",
      "successMessage": "Mulțumim! Locul tău este rezervat. Ți-am trimis detaliile pe email — verifică și folderul Spam.",
      "createLead": true
    }
  },
  {
    "id": "lansare-produs-reducere",
    "name": "Lansare cu reducere",
    "category": "E-commerce",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "AuraPods Pro — sunet care îți schimbă ziua",
          "subheading": "Lansare oficială cu -40% reducere, doar pentru primele 200 de comenzi. Anularea zgomotului, 36h autonomie și confort all-day, la cel mai mic preț de până acum.",
          "ctaText": "Cumpără acum cu -40%",
          "ctaHref": "#",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Anularea activă a zgomotului",
              "body": "Reduce până la 95% din zgomotul de fundal. Te concentrezi pe muzică, apeluri sau muncă, oriunde ai fi."
            },
            {
              "title": "36 de ore autonomie",
              "body": "O singură încărcare îți ajunge toată săptămâna. 10 minute la priză înseamnă încă 4 ore de redare."
            },
            {
              "title": "Confort all-day",
              "body": "Doar 4,8 grame per cască, cu vârfuri din silicon medical în 4 mărimi. Le uiți în urechi."
            }
          ]
        }
      },
      {
        "type": "image",
        "props": {
          "url": "https://picsum.photos/seed/aurapods/1200/600",
          "alt": "AuraPods Pro pe fundal modern",
          "width": 1200
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "Construite pentru ritmul tău",
          "level": "h2",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 2,
          "items": [
            {
              "title": "Rezistente la apă IPX5",
              "body": "Antrenamente, ploaie sau transpirație — nicio grijă. Făcute pentru un stil de viață activ."
            },
            {
              "title": "Conectare instant Bluetooth 5.3",
              "body": "Se asociază în 2 secunde și comută automat între telefon și laptop, fără bătăi de cap."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "Le port zilnic la birou și la sală. Anularea zgomotului e impresionantă pentru prețul ăsta, iar bateria chiar ține cât promit. Cea mai bună achiziție de anul acesta.",
          "author": "Andrei M., client verificat"
        }
      },
      {
        "type": "faq",
        "props": {
          "items": [
            {
              "q": "Cât durează reducerea de lansare?",
              "a": "Prețul de lansare cu -40% este valabil pentru primele 200 de comenzi sau până la epuizarea stocului promoțional. După aceea revenim la prețul standard."
            },
            {
              "q": "Cât durează livrarea?",
              "a": "Livrăm în 24-48h prin curier în toată țara. Comenzile peste 199 lei au transport gratuit."
            },
            {
              "q": "Pot returna produsul?",
              "a": "Da, ai 30 de zile drept de retur, fără întrebări. Dacă nu ești mulțumit, îți returnăm banii integral."
            },
            {
              "q": "Ce garanție au căștile?",
              "a": "AuraPods Pro vin cu 24 de luni garanție și suport tehnic în limba română."
            }
          ]
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "Stocul de lansare se epuizează rapid. Prinde prețul redus înainte să dispară.",
          "level": "h3",
          "align": "center"
        }
      },
      {
        "type": "button",
        "props": {
          "text": "Cumpără acum cu -40%",
          "href": "#",
          "align": "center"
        }
      }
    ],
    "design": {
      "base": "midnight",
      "vars": {
        "bg-0": "#0b0f1a",
        "bg-1": "#141a2b",
        "fg-0": "#f5f7fb",
        "fg-1": "#a7b0c4",
        "border": "#262f45",
        "accent": "#ff5a36",
        "accent-dark": "#d63f1f",
        "accent-contrast": "#ffffff"
      },
      "digital": true,
      "bgImage": "",
      "animation": "sheen",
      "headingFont": "spacegrotesk",
      "bodyFont": "inter"
    },
    "pageDecor": {
      "effect": "grid",
      "interaction": "mouseParallax",
      "density": 40,
      "speed": 18,
      "size": 8,
      "color": "",
      "opacity": 0.25,
      "intensity": 28
    },
    "form": {
      "enabled": false,
      "fields": [],
      "submitLabel": "Trimite",
      "successMessage": "Mulțumim!",
      "createLead": false
    }
  },
  {
    "id": "consultanta-b2b-lead-gen",
    "name": "Consultanță B2B – Lead-uri",
    "category": "Servicii B2B",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "Mai mulți clienți B2B, cu un cost de achiziție pe care îl poți măsura",
          "subheading": "Suntem partenerul de consultanță care transformă obiectivele de business în lead-uri calificate și venit predictibil. Audit gratuit, plan de acțiune clar și execuție orientată spre ROI.",
          "ctaText": "Solicită auditul gratuit",
          "ctaHref": "#",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 4,
          "items": [
            {
              "title": "+120",
              "body": "companii B2B consiliate"
            },
            {
              "title": "15 ani",
              "body": "experiență în piață"
            },
            {
              "title": "+38%",
              "body": "creștere medie a lead-urilor"
            },
            {
              "title": "4,9/5",
              "body": "satisfacția clienților"
            }
          ]
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Diagnostic complet în 7 zile",
              "body": "Analizăm procesele, vânzările și piața ta, apoi livrăm un raport cu prioritățile care aduc cele mai rapide rezultate."
            },
            {
              "title": "Strategie orientată spre ROI",
              "body": "Fiecare recomandare are un indicator clar de performanță. Investești doar în acțiuni care se traduc în creștere."
            },
            {
              "title": "Execuție alături de echipa ta",
              "body": "Nu lăsăm strategia pe hârtie. Implementăm împreună cu echipa ta și monitorizăm rezultatele lună de lună."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "În primele 6 luni de colaborare am crescut numărul de lead-uri calificate cu 38% și am redus costul de achiziție cu aproape un sfert. Îi recomandăm fără rezerve oricărei companii B2B serioase.",
          "author": "Andreea Marinescu, Director Comercial – TechFlow Solutions"
        }
      },
      {
        "type": "faq",
        "props": {
          "items": [
            {
              "q": "Cât durează până văd primele rezultate?",
              "a": "Primul diagnostic îl livrăm în 7 zile lucrătoare. Primele îmbunătățiri măsurabile apar, de regulă, în 30–60 de zile de la implementare."
            },
            {
              "q": "Lucrați cu companii din industria mea?",
              "a": "Avem experiență în servicii profesionale, producție, IT și distribuție B2B. Solicită oferta și îți spunem din prima discuție dacă suntem potriviți pentru afacerea ta."
            },
            {
              "q": "Cum se stabilește prețul?",
              "a": "Oferta este personalizată în funcție de obiective și de amploarea proiectului. Discuția inițială și auditul preliminar sunt gratuite, fără obligații."
            }
          ]
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "Hai să discutăm despre creșterea afacerii tale",
          "level": "h2",
          "align": "center"
        }
      },
      {
        "type": "text",
        "props": {
          "text": "Completează formularul de mai jos și un consultant senior te va contacta în maximum 24 de ore cu o ofertă personalizată, fără obligații.",
          "align": "center"
        }
      },
      {
        "type": "form",
        "props": {
          "heading": "Solicită auditul tău gratuit"
        }
      }
    ],
    "design": {
      "base": "midnight",
      "vars": {
        "bg-0": "#0b1220",
        "bg-1": "#111c32",
        "fg-0": "#eef2f9",
        "fg-1": "#9fb0cc",
        "border": "#243352",
        "accent": "#3b82f6",
        "accent-dark": "#2563eb",
        "accent-contrast": "#ffffff"
      },
      "digital": true,
      "bgImage": "",
      "animation": "sheen",
      "headingFont": "poppins",
      "bodyFont": "inter"
    },
    "pageDecor": {
      "effect": "grid",
      "interaction": "mouseParallax",
      "density": 40,
      "speed": 16,
      "size": 6,
      "color": "#3b82f6",
      "opacity": 0.22,
      "intensity": 30
    },
    "form": {
      "enabled": true,
      "fields": [
        {
          "name": "company",
          "label": "Numele firmei",
          "type": "text",
          "required": true,
          "options": []
        },
        {
          "name": "email",
          "label": "Email de business",
          "type": "email",
          "required": true,
          "options": []
        },
        {
          "name": "phone",
          "label": "Telefon",
          "type": "tel",
          "required": true,
          "options": []
        },
        {
          "name": "budget",
          "label": "Buget lunar de marketing",
          "type": "select",
          "required": false,
          "options": [
            "Sub 2.000 €",
            "2.000 – 5.000 €",
            "5.000 – 10.000 €",
            "Peste 10.000 €"
          ]
        },
        {
          "name": "message",
          "label": "Care este principalul tău obiectiv?",
          "type": "textarea",
          "required": false,
          "options": []
        }
      ],
      "submitLabel": "Solicită auditul gratuit",
      "successMessage": "Mulțumim! Un consultant senior te va contacta în maximum 24 de ore.",
      "createLead": true
    }
  },
  {
    "id": "webinar-gratuit-marketing-digital",
    "name": "Webinar Gratuit Marketing",
    "category": "Educație / Webinar",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "Webinar gratuit: primii pași spre o carieră în marketing digital",
          "subheading": "Joi, 26 iunie 2026, ora 19:00 (ora României) · Online, pe Zoom · 90 de minute. Locuri limitate — participarea este gratuită, dar înscrierea este obligatorie.",
          "ctaText": "Rezervă-ți locul gratuit",
          "ctaHref": "#inscriere",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Cum funcționează marketingul digital azi",
              "body": "Înțelegi pe scurt canalele care chiar aduc clienți: SEO, social media, reclame plătite și email — fără jargon complicat."
            },
            {
              "title": "Primul tău plan, în 7 pași",
              "body": "Pleci acasă cu un mini-plan clar, pe care îl poți aplica imediat, chiar dacă pornești de la zero și nu ai buget mare."
            },
            {
              "title": "Greșelile pe care le fac începătorii",
              "body": "Afli capcanele care îți irosesc timpul și banii, ca să le eviți din prima și să vezi rezultate mai repede."
            },
            {
              "title": "Ce instrumente gratuite să folosești",
              "body": "O listă practică de unelte gratuite pentru analiză, design și planificare, testate de noi în proiecte reale."
            },
            {
              "title": "Cum măsori ce funcționează",
              "body": "Înveți să citești cifrele esențiale, ca să știi mereu pe ce să te concentrezi și ce să oprești."
            },
            {
              "title": "Sesiune live de întrebări",
              "body": "La final răspundem direct la întrebările tale. Vino cu situația ta concretă și pleci cu un răspuns."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "Am intrat fără să știu nimic despre marketing și am ieșit cu un plan clar, pe care l-am pus în practică a doua zi. În prima lună am avut deja primele cereri prin Instagram. Cel mai util webinar gratuit la care am participat.",
          "author": "Andreea M., proprietară mic atelier handmade, Cluj"
        }
      },
      {
        "type": "faq",
        "props": {
          "items": [
            {
              "q": "Webinarul este cu adevărat gratuit?",
              "a": "Da, participarea este 100% gratuită. Tot ce trebuie să faci este să te înscrii cu numele și emailul tău, ca să îți trimitem linkul de acces."
            },
            {
              "q": "Am nevoie de cunoștințe anterioare?",
              "a": "Nu. Webinarul este gândit pentru începători, așa că pornim de la bază. Dacă ai deja experiență, vei prinde idei noi de optimizare."
            },
            {
              "q": "Ce se întâmplă dacă nu pot participa live?",
              "a": "Înscrie-te oricum. Toți participanții înregistrați primesc pe email înregistrarea, disponibilă timp de 7 zile după eveniment."
            },
            {
              "q": "De ce am nevoie ca să particip?",
              "a": "Doar de un laptop sau un telefon cu conexiune la internet. Folosim Zoom, iar linkul de acces îl primești pe email după înscriere."
            }
          ]
        }
      },
      {
        "type": "form",
        "props": {
          "heading": "Rezervă-ți locul acum — este gratuit"
        }
      },
      {
        "type": "text",
        "props": {
          "text": "Locurile sunt limitate la 100 de participanți și se ocupă rapid. Înscrie-te azi ca să fii sigur că prinzi loc — și ca să primești bonusul: ghidul PDF „Checklist marketing pentru începători”.",
          "align": "center"
        }
      }
    ],
    "design": {
      "base": "ocean",
      "vars": {
        "bg-0": "#08192b",
        "bg-1": "#0f2c47",
        "fg-0": "#f1f8ff",
        "fg-1": "#b3cce2",
        "border": "#1e3a57",
        "accent": "#ffb020",
        "accent-dark": "#e0950a",
        "accent-contrast": "#08192b"
      },
      "digital": true,
      "bgImage": "",
      "animation": "sheen",
      "headingFont": "poppins",
      "bodyFont": "dmsans"
    },
    "pageDecor": {
      "effect": "bubbles",
      "interaction": "mouseParallax",
      "density": 30,
      "speed": 18,
      "size": 8,
      "color": "#ffb020",
      "opacity": 0.22,
      "intensity": 35
    },
    "form": {
      "enabled": true,
      "fields": [
        {
          "name": "name",
          "label": "Nume și prenume",
          "type": "text",
          "required": true,
          "options": []
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "required": true,
          "options": []
        },
        {
          "name": "phone",
          "label": "Telefon (opțional)",
          "type": "tel",
          "required": false,
          "options": []
        }
      ],
      "submitLabel": "Rezervă-ți locul gratuit",
      "successMessage": "Mulțumim! Ți-am trimis pe email confirmarea și linkul de acces. Ne vedem la webinar!",
      "createLead": true
    }
  },
  {
    "id": "app-download-tech-lp",
    "name": "Aplicație Tech Download",
    "category": "Aplicație mobilă",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "Aplicația care îți pune timpul la lucru",
          "subheading": "Organizează, automatizează și controlează totul dintr-un singur loc. Rapidă, sigură și gândită din temelii pentru telefonul tău.",
          "ctaText": "Descarcă gratuit",
          "ctaHref": "#download",
          "align": "center"
        }
      },
      {
        "type": "image",
        "props": {
          "url": "https://picsum.photos/seed/appmockup/1200/600",
          "alt": "Mockup al aplicației mobile pe ecranul telefonului",
          "width": 1100
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Sincronizare instant",
              "body": "Datele tale se actualizează în timp real pe toate dispozitivele, fără să apeși vreun buton."
            },
            {
              "title": "Securitate end-to-end",
              "body": "Criptare la nivel de bancă și autentificare biometrică. Informațiile tale rămân doar ale tale."
            },
            {
              "title": "Mod offline",
              "body": "Lucrează oriunde, chiar și fără internet. Aplicația sincronizează automat când revii online."
            },
            {
              "title": "Notificări inteligente",
              "body": "Primești doar ce contează, când contează. Fără spam, fără zgomot inutil."
            },
            {
              "title": "Configurare în câteva secunde",
              "body": "Deschizi aplicația și ești gata. Fără tutoriale lungi, fără pași inutili."
            },
            {
              "title": "Suport real, în română",
              "body": "O echipă care îți răspunde rapid și pe înțeles, oricând ai nevoie."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "De când folosesc aplicația, economisesc cel puțin o oră pe zi. Interfața e curată, totul merge instant și pur și simplu funcționează. A fost cea mai bună decizie pentru echipa mea.",
          "author": "Andrei M., fondator startup, București"
        }
      },
      {
        "type": "spacer",
        "props": {
          "size": 32
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "Descarc-o acum, e gratuită",
          "level": "h2",
          "align": "center"
        }
      },
      {
        "type": "text",
        "props": {
          "text": "Disponibilă pe iOS și Android. Instalare în mai puțin de 30 de secunde, fără cont obligatoriu ca să începi.",
          "align": "center"
        }
      },
      {
        "type": "button",
        "props": {
          "text": "Descarcă pe App Store",
          "href": "#appstore",
          "align": "center"
        }
      },
      {
        "type": "button",
        "props": {
          "text": "Descarcă pe Google Play",
          "href": "#googleplay",
          "align": "center"
        }
      }
    ],
    "design": {
      "base": "midnight",
      "vars": {
        "bg-0": "#0a0e1a",
        "bg-1": "#121829",
        "fg-0": "#f1f5fb",
        "fg-1": "#9aa7c2",
        "border": "#23304d",
        "accent": "#3ddc97",
        "accent-dark": "#22b377",
        "accent-contrast": "#06140d"
      },
      "digital": true,
      "bgImage": "",
      "animation": "sheen",
      "headingFont": "spacegrotesk",
      "bodyFont": "inter"
    },
    "pageDecor": {
      "effect": "grid",
      "interaction": "mouseParallax",
      "density": 40,
      "speed": 18,
      "size": 6,
      "color": "#3ddc97",
      "opacity": 0.22,
      "intensity": 30
    },
    "form": {
      "enabled": false,
      "fields": [],
      "submitLabel": "Trimite",
      "successMessage": "Mulțumim!",
      "createLead": false
    }
  },
  {
    "id": "clinica-programare-rapida",
    "name": "Clinică Programare",
    "category": "Medical / Sănătate",
    "lang": "ro",
    "blocks": [
      {
        "type": "hero",
        "props": {
          "heading": "Sănătatea ta, în mâini de încredere",
          "subheading": "Programează o consultație în mai puțin de un minut. Medici cu experiență, aparatură modernă și o echipă caldă, care te ascultă cu adevărat.",
          "ctaText": "Programează-te acum",
          "ctaHref": "#programare",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Consultații generale",
              "body": "Evaluare completă a stării de sănătate, diagnostic clar și un plan de tratament gândit special pentru tine."
            },
            {
              "title": "Analize și investigații",
              "body": "Recoltare rapidă, rezultate explicate pe înțelesul tău și recomandări concrete pentru pașii următori."
            },
            {
              "title": "Medicină de specialitate",
              "body": "Cardiologie, dermatologie, ginecologie și pediatrie — specialiști dedicați, sub același acoperiș."
            },
            {
              "title": "Programe de prevenție",
              "body": "Pachete de control periodic care depistează din timp problemele și te ajută să rămâi sănătos, nu doar să te tratezi."
            },
            {
              "title": "Telemedicină",
              "body": "Consultații online pentru situațiile simple, fără să mai pierzi timp pe drum sau în sala de așteptare."
            },
            {
              "title": "Urgențe minore",
              "body": "Programări în aceeași zi pentru ce nu poate aștepta, cu prioritate pentru pacienții noștri."
            }
          ]
        }
      },
      {
        "type": "heading",
        "props": {
          "text": "De ce ne aleg pacienții",
          "level": "h2",
          "align": "center"
        }
      },
      {
        "type": "features",
        "props": {
          "columns": 3,
          "items": [
            {
              "title": "Timp dedicat fiecărui pacient",
              "body": "Nu te grăbim niciodată. Consultațiile sunt programate cu timp suficient ca să primești toate răspunsurile."
            },
            {
              "title": "Programare simplă, fără cozi",
              "body": "Alegi serviciul, lași numărul de telefon și te sunăm în maximum 30 de minute pentru confirmare."
            },
            {
              "title": "Mediu cald și curat",
              "body": "O clinică gândită să te simți în siguranță: spații luminoase, igienă riguroasă și un personal amabil."
            }
          ]
        }
      },
      {
        "type": "testimonial",
        "props": {
          "quote": "Am venit cu emoții, dar doamna doctor mi-a explicat totul cu răbdare și am plecat liniștită. Programarea a durat un minut, iar la clinică nu am așteptat deloc. E primul loc unde chiar m-am simțit ascultată.",
          "author": "Andreea M., pacientă din 2023"
        }
      },
      {
        "type": "faq",
        "props": {
          "items": [
            {
              "q": "Cât durează până sunt sunat pentru confirmare?",
              "a": "Te sunăm în maximum 30 de minute, în intervalul 08:00 – 20:00, pentru a stabili împreună data și ora potrivite."
            },
            {
              "q": "Pot deconta consultația prin asigurare?",
              "a": "Da, lucrăm cu principalii asigurători și emitem toate documentele necesare pentru decont. Spune-ne la telefon ce asigurare ai."
            },
            {
              "q": "Ce trebuie să aduc la prima vizită?",
              "a": "Un act de identitate și, dacă ai, analizele sau scrisorile medicale anterioare. Restul îți explicăm noi, pas cu pas."
            },
            {
              "q": "Pot anula sau reprograma?",
              "a": "Sigur. Ne anunți cu cel puțin câteva ore înainte și găsim împreună un alt interval, fără niciun cost."
            }
          ]
        }
      },
      {
        "type": "form",
        "props": {
          "heading": "Programează-te acum"
        }
      },
      {
        "type": "text",
        "props": {
          "text": "Te sunăm în cel mult 30 de minute, în intervalul orar 08:00 – 20:00, pentru a confirma data și ora potrivite pentru tine.",
          "align": "center"
        }
      },
      {
        "type": "button",
        "props": {
          "text": "Programează-te acum",
          "href": "#programare",
          "align": "center"
        }
      }
    ],
    "design": {
      "base": "light",
      "vars": {
        "bg-0": "#f4faf9",
        "bg-1": "#ffffff",
        "fg-0": "#13302f",
        "fg-1": "#4a6a68",
        "border": "#d6ebe8",
        "accent": "#2bb3a6",
        "accent-dark": "#1c8076",
        "accent-contrast": "#ffffff"
      },
      "digital": true,
      "bgImage": "",
      "animation": "none",
      "headingFont": "poppins",
      "bodyFont": "dmsans"
    },
    "pageDecor": {
      "effect": "bubbles",
      "interaction": "mouseParallax",
      "density": 16,
      "speed": 12,
      "size": 9,
      "color": "#2bb3a6",
      "opacity": 0.22,
      "intensity": 28
    },
    "form": {
      "enabled": true,
      "fields": [
        {
          "name": "nume",
          "label": "Nume și prenume",
          "type": "text",
          "required": true,
          "options": []
        },
        {
          "name": "telefon",
          "label": "Număr de telefon",
          "type": "tel",
          "required": true,
          "options": []
        },
        {
          "name": "serviciu",
          "label": "Serviciu dorit",
          "type": "select",
          "required": true,
          "options": [
            "Consultație generală",
            "Analize și investigații",
            "Cardiologie",
            "Dermatologie",
            "Ginecologie",
            "Pediatrie",
            "Consultație online (telemedicină)"
          ]
        },
        {
          "name": "mesaj",
          "label": "Pe scurt, ce te aduce la noi? (opțional)",
          "type": "textarea",
          "required": false,
          "options": []
        },
        {
          "name": "acord",
          "label": "Sunt de acord să fiu contactat(ă) telefonic pentru programare.",
          "type": "checkbox",
          "required": true,
          "options": []
        }
      ],
      "submitLabel": "Programează-te",
      "successMessage": "Mulțumim! Te sunăm în cel mult 30 de minute pentru a confirma programarea.",
      "createLead": true
    }
  }
];
