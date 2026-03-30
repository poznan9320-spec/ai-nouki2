import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | DeliveryHub',
  description: 'DeliveryHub アプリのプライバシーポリシー',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-gray-500 mb-10">最終更新日：2026年3月30日</p>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">1. 事業者情報</h2>
        <p>
          本プライバシーポリシーは、DeliveryHub（以下「本アプリ」）における
          個人情報の取り扱いについて定めるものです。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">2. 収集する情報</h2>
        <p className="mb-2">本アプリは以下の情報を収集します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>メールアドレス（アカウント認証・ログインのため）</li>
          <li>氏名（プロフィール表示・チームメンバー識別のため）</li>
          <li>会社名（所属組織の管理のため）</li>
          <li>入荷・納期データ（アプリの主機能提供のため）</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">3. カメラ・フォトライブラリの利用</h2>
        <p className="mb-2">
          本アプリはカメラおよびフォトライブラリへのアクセスを以下の目的のみに使用します。
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>発注書・納品書の写真をAI-OCRで読み取り、入荷データを自動登録する</li>
          <li>従業員招待用のQRコードをスキャンする</li>
        </ul>
        <p className="mt-2">
          撮影・選択された画像はOCR処理のためのみ使用され、
          お客様の明示的な操作なしに外部に送信されることはありません。
          デバイス上の写真ライブラリへの書き込みは行いません。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">4. 情報の利用目的</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>アカウント認証およびログイン機能の提供</li>
          <li>入荷・納期管理機能の提供</li>
          <li>AIチャット機能による入荷データの検索・回答</li>
          <li>入荷予定のプッシュ通知の送信</li>
          <li>チーム・従業員管理機能の提供</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">5. 第三者への提供</h2>
        <p className="mb-2">
          収集した個人情報は、以下の場合を除き第三者に提供しません。
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            AIチャット機能の提供のため、入荷データのクエリをAI APIサービス
            （Anthropic Claude）に送信することがあります。
            この際、個人を特定できる情報は含まれません。
          </li>
          <li>法令に基づく場合</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">6. トラッキング</h2>
        <p>
          本アプリはユーザーの行動を他社サービスと照合するトラッキングを一切行いません。
          広告目的でのデータ収集も行いません。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">7. データの保管と削除</h2>
        <p>
          収集したデータはVercelのサーバー（日本またはアメリカ）上のPostgreSQLデータベースに
          安全に保管されます。アカウントの削除をご希望の場合は、
          下記お問い合わせ先までご連絡ください。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">8. お問い合わせ</h2>
        <p>
          本プライバシーポリシーに関するお問い合わせは以下までご連絡ください。
        </p>
        <p className="mt-2 font-mono">support@deliveryhub.app</p>
      </section>

      <p className="text-gray-400 text-xs mt-12">
        本ポリシーは予告なく変更される場合があります。
        重要な変更がある場合はアプリ内でお知らせします。
      </p>
    </main>
  )
}
