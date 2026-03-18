import Link from "next/link";
import { Card, CardContent, CardDescription } from "./card";

export default function StatsCard({title , statnumber , icon : Icon, href}){
    const inner = (
        <Card className={href ? "transition-colors hover:bg-muted/50 cursor-pointer" : ""}>
            <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <CardDescription className="text-xs mb-1">
                            {title}
                        </CardDescription>
                        <p className="text-3xl font-bold leading-none">
                            {statnumber}
                        </p>
                    </div>
                    <Icon className="text-mainColor h-4 w-4 mt-1 shrink-0" />
                </div>
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link href={href} className="block">{inner}</Link>
    }
    return inner
}
