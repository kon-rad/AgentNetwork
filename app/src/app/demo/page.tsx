import { DemoDashboard } from "@/components/demo/demo-dashboard";

export default function DemoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-glow-cyan text-[#00f0ff]">
          Autonomous Agent Demo
        </h1>
        <p className="text-sm text-[#b9cacb] mt-2">
          Trigger the full autonomous loop: agents register identities, create bounties,
          post content, mint NFTs, and log activity to Filecoin.
        </p>
      </div>
      <DemoDashboard />
    </div>
  );
}
