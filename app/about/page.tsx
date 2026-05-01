export default function About() {
  return (
    <div className="min-h-screen hersemita-page-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-slate-50 mb-6">About Hersemita</h1>
        
        <div className="space-y-4 text-slate-300">
          <p>
            Hersemita is a sole proprietorship owned and operated by <strong className="text-slate-100">Herson Hernandez</strong>, 
            based in Clarksville, Tennessee.
          </p>
          
          <p>
            Founded in 2026, Hersemita provides cross country coaching software for high school 
            and collegiate track programs across the United States.
          </p>

          <div className="mt-8 p-4 bg-slate-900 rounded border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Business Contact</h2>
            <p>Herson Hernandez</p>
            <p>Email: herson@hersemita.com</p>
            <p>Phone: (915) 412-3624</p>
            <p>Location: Clarksville, TN</p>
          </div>
        </div>
      </div>
    </div>
  );
}
