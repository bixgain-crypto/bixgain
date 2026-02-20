import { AppLayout } from "@/components/AppLayout";

export default function About() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-12">
        <h1 className="text-3xl font-bold mb-4">About BixGain</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          BixGain is a crypto reward platform where users can earn BIX tokens by completing tasks, participating in activities, and referring friends. Our mission is to make earning crypto easy, fun, and accessible for everyone.
        </p>
        <ul className="list-disc pl-6 mb-6">
          <li>Earn rewards for completing tasks</li>
          <li>Secure ledger for safe transactions</li>
          <li>Instant payouts and referral bonuses</li>
        </ul>
        <p className="text-muted-foreground">
          For more information, visit our documentation or contact support.
        </p>
      </div>
    </AppLayout>
  );
}
