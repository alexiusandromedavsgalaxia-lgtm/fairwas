import React from "react";
import { YourCodePage } from "./CreatePage";

export default function YourCode({url,onNavigate}){
 return <YourCodePage url={url||"httc://yourcode.official/"} onNavigate={onNavigate}/>;
}
