import Link from "next/link";
import { Card, CardContent, CardDescription, CardTitle } from "./card";

export default function StatsCard({title , statnumber , icon : Icon, href}){
    const inner = (
        <Card className={href ? "transition-colors hover:bg-muted/50 cursor-pointer" : ""}>
            <CardContent>
                <div className='flex items-center justify-between'>
                    <CardDescription>
                        {title}
                    </CardDescription>
                    <Icon className='text-mainColor'/>
                </div>
                <CardTitle className='text-2xl'>
                    {statnumber}
                </CardTitle>
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link href={href} className="block">{inner}</Link>
    }
    return inner
}