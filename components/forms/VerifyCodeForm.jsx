import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export default function VerifyCodeForm({ code, setCode, error, onStartOver }) {
  return <>
    <p className="text-sm text-muted-foreground">
      We sent a 6-character verification code to your Troopiter email address. Enter it below to continue.
    </p>
    <div className="space-y-2">
      <Label htmlFor="verificationCode">Verification Code</Label>
      <Input
        id="verificationCode"
        type="text"
        placeholder="e.g. 4X7K2P"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="tracking-widest font-mono text-center text-lg"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
    <Button type="button" variant="link" className="px-0 text-sm" onClick={onStartOver}>
      Didn't get a code? Start over
    </Button>
  </>
}
