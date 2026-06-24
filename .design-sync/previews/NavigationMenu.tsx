import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@northstar/web";

export const Default = () => (
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Products</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="grid w-[320px] gap-2 p-3">
            <li><NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">Portfolio tracking</NavigationMenuLink></li>
            <li><NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">Goal planning</NavigationMenuLink></li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem><NavigationMenuLink className="px-3 py-2 text-sm font-medium">Pricing</NavigationMenuLink></NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);
