
import { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { usePopup } from "@/context/PopupContext";
import { useNetwork } from "@/context/NetworksContext";
import { TEXTAREA_MAX_LENGTH } from "@/lib/utils";

export default function NetworkPopup(){
    const [network, setNetwork] = useState({
        name : '',
        description : '',
    })
    const { createNetwork, getAllNetworks , isLoading} = useNetwork()
    const { closePopup } = usePopup()
    const [loading , setLoading] = useState(false)
    const [validationError , setValidationErrors] = useState({})
    const validateForm = () => {
        const newErrors = {}
        if (!network.name.trim()) newErrors.name = "Network name is required"
        if (!network.description.trim()) newErrors.description = "Network description is required"
        setValidationErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }
    const handleCreateNetwork = async () => {
        if (validateForm()){
            try {
                setLoading(true)
                await createNetwork(network)
            }
            catch {

            }
            finally {
                setLoading(false)
            }
            closePopup()
        }
    }
    const handleChange = (e) => {
        setNetwork(prev => ({ ...prev, [e.target.id]: e.target.value }))
    }
    return <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor='name'>Network name</Label>
            <Input id="name" type="text" placeholder="Network name" value={network.name} onChange={handleChange} />
            {validationError.name && <p className="text-red-500 text-sm">{validationError.name}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor='description'>Network description</Label>
            <Textarea id="description" className="resize-none h-45" type="text" placeholder="Network description" value={network.description} onChange={handleChange} maxLength={TEXTAREA_MAX_LENGTH} />
            {validationError.description && <p className="text-red-500 text-sm">{validationError.description}</p>}
        </div>
        <div className="flex justify-end gap-4">
            <Button onClick={closePopup} variant='outline'>Cancel</Button>
            <Button onClick={handleCreateNetwork} disabled={loading}>{loading ? 'Creating...' : 'Create network'}</Button>
        </div>
        
    </div>
}