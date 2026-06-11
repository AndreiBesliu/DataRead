/**
 * Română — dicționarul PRIMAR (sursa de adevăr). en.ts trebuie să oglindească exact aceste chei
 * (`const en: typeof ro`), paritate verificată de compilator la fiecare build.
 * TOT textul user-facing trece pe aici — niciun string hardcodat în componente.
 */
const ro = {
  app: {
    name: 'DataRead',
    tagline: 'Platforma de marketing cu AI pentru firme mici și mijlocii',
  },
  notFound: {
    title: 'Pagina nu există',
    back: 'Înapoi la prima pagină',
  },
  error: {
    title: 'A apărut o eroare.',
    body: 'Ne pare rău — ceva nu a funcționat. Reîncarcă pagina; dacă problema persistă, apasă „Resetează datele aplicației".',
    reload: 'Reîncarcă',
    reset: 'Resetează datele aplicației',
    resetConfirm: 'Ștergi datele locale ale aplicației (preferințe, draft-uri) de pe acest dispozitiv? Contul și datele din cloud NU sunt afectate.',
  },
};

export default ro;
