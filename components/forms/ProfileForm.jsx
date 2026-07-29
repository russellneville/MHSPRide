import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRef } from "react";
import { TEXTAREA_MAX_LENGTH, NAME_MAX_LENGTH, PHONE_MAX_LENGTH } from "@/lib/utils";
import { Camera, User } from "lucide-react";

export const PROFILE_SECTION_CARD_CLASS = "bg-muted/65 dark:bg-[oklch(0.39_0_0)]"

// Personal-information card shared between the self-service profile page
// (app/dashboard/profile) and the admin user-detail page
// (app/dashboard/admin/users/[uid]) — photo upload is opt-in via
// onPhotoChange since only the self-service page supports it.
export default function ProfileForm({ profile, setProfile, displayName, photoSrc, onPhotoError, onPhotoChange, uploading = false, className }) {
  const fileInputRef = useRef(null)

  const handleChange = e => {
    setProfile(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  return (
    <Card className={`${PROFILE_SECTION_CARD_CLASS} ${className || ''}`}>
      <CardHeader className='!pb-3 border-b border-border'>
        <CardTitle>
          Personal information
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className="flex items-center gap-4 pb-2">
          <div className="relative shrink-0">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt="Profile photo"
                className="w-16 h-16 rounded-full object-cover border border-border"
                onError={onPhotoError}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            {onPhotoChange && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Change photo"
                >
                  <Camera className="w-3 h-3" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPhotoChange}
                />
              </>
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            {onPhotoChange && (
              <p className="text-xs text-muted-foreground">{uploading ? 'Uploading…' : 'Click the camera icon to change your photo'}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullname">Full name</Label>
          <Input id="fullname" type="text" maxLength={NAME_MAX_LENGTH} onChange={handleChange} value={profile.fullname || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">phone number</Label>
          <Input id="phone" type="text" maxLength={PHONE_MAX_LENGTH} onChange={handleChange} value={profile.phone || ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor='bio'>Bio</Label>
          <Textarea value={profile.bio || ''} id='bio' onChange={handleChange} placeholder='Describe you there' className='resize-none h-45' maxLength={TEXTAREA_MAX_LENGTH}></Textarea>
        </div>
      </CardContent>
    </Card>
  )
}
