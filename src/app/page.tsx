export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">AI納期管理 API</h1>
      <p className="mt-4 text-gray-600">バックエンドAPIサーバーが稼働中です</p>
      <div className="mt-8 text-sm text-gray-500">
        <p>利用可能なエンドポイント:</p>
        <ul className="mt-2 space-y-1 font-mono">
          <li>POST /api/mobile/register</li>
          <li>POST /api/mobile/login</li>
          <li>GET/POST /api/mobile/deliveries</li>
          <li>GET/POST /api/mobile/request</li>
          <li>GET/POST /api/mobile/chat</li>
          <li>POST /api/ingest/csv</li>
          <li>POST /api/ingest/ocr</li>
        </ul>
      </div>
    </main>
  );
}
