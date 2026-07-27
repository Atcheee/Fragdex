"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
} from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  Books,
  Buildings,
  CaretDown,
  ChartBar,
  Compass,
  Copy,
  Heart,
  IdentificationCard,
  MapTrifold,
  Scales,
  TrendUp,
  Wrench,
} from "@phosphor-icons/react";
import { FragranceBottleIcon } from "@/components/FragranceBottleIcon";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  isActive: (pathname: string) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    id: "explore",
    label: "Explore",
    icon: Compass,
    items: [
      {
        href: "/fragrances",
        label: "Fragrances",
        icon: FragranceBottleIcon,
        isActive: (pathname) =>
          pathname.startsWith("/fragrances") ||
          pathname.startsWith("/fragrance/"),
      },
      {
        href: "/clones",
        label: "Clones",
        icon: Copy,
        isActive: (pathname) =>
          pathname.startsWith("/clones") || pathname.startsWith("/clone/"),
      },
      {
        href: "/houses",
        label: "Houses",
        icon: Buildings,
        isActive: (pathname) =>
          pathname.startsWith("/houses") || pathname.startsWith("/house/"),
      },
      {
        href: "/atlas",
        label: "Atlas",
        icon: MapTrifold,
        isActive: (pathname) => pathname.startsWith("/atlas"),
      },
      {
        href: "/trends",
        label: "Trends",
        icon: TrendUp,
        isActive: (pathname) => pathname.startsWith("/trends"),
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    items: [
      {
        href: "/compare",
        label: "Compare",
        icon: Scales,
        isActive: (pathname) => pathname.startsWith("/compare"),
      },
      {
        href: "/swap-a-note",
        label: "Swap a Note",
        icon: ArrowsLeftRight,
        isActive: (pathname) => pathname.startsWith("/swap-a-note"),
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    icon: Books,
    items: [
      {
        href: "/favorites",
        label: "Favorites",
        icon: Heart,
        isActive: (pathname) => pathname.startsWith("/favorites"),
      },
      {
        href: "/collection",
        label: "Collection",
        icon: ChartBar,
        isActive: (pathname) => pathname.startsWith("/collection"),
      },
      {
        href: "/passport",
        label: "Passport",
        icon: IdentificationCard,
        isActive: (pathname) => pathname.startsWith("/passport"),
      },
    ],
  },
];

function groupIsActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => item.isActive(pathname));
}

function NavDropdown({
  group,
  pathname,
  open,
  onOpenChange,
  align = "center",
}: {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "start" | "center" | "end";
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const active = groupIsActive(group, pathname);
  const GroupIcon = group.icon;
  const menuAlign =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 md:flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
        className={`flex w-full min-h-11 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0 md:w-auto md:rounded-full md:px-3.5 md:py-1.5 ${
          active || open
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-card-hover hover:text-foreground"
        }`}
      >
        <GroupIcon
          size={16}
          weight={active || open ? "fill" : "regular"}
          className="shrink-0 md:size-[15px]"
          aria-hidden
        />
        <span className="truncate">{group.label}</span>
        <CaretDown
          size={12}
          weight="bold"
          className={`shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={group.label}
          className={`absolute top-[calc(100%+0.4rem)] z-50 w-max min-w-[11.5rem] rounded-2xl border border-border bg-card p-1.5 shadow-[0_12px_40px_color-mix(in_oklab,var(--foreground)_12%,transparent)] ${menuAlign}`}
        >
          {group.items.map(({ href, label, icon: Icon, isActive }) => {
            const itemActive = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                prefetch={false}
                aria-current={itemActive ? "page" : undefined}
                onClick={() => onOpenChange(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  itemActive
                    ? "bg-accent-soft text-accent"
                    : "text-foreground hover:bg-card-hover"
                }`}
              >
                <Icon
                  size={16}
                  weight={itemActive ? "fill" : "regular"}
                  aria-hidden
                />
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<{
    id: string;
    pathname: string;
  } | null>(null);
  const openId = openMenu?.pathname === pathname ? openMenu.id : null;

  return (
    <nav
      aria-label="Primary navigation"
      className="col-span-3 row-start-3 md:col-span-1 md:col-start-2 md:row-start-1"
    >
      <div className="flex items-stretch gap-1 rounded-2xl border border-border bg-card p-1 md:w-auto md:items-center md:rounded-full md:px-1 md:py-1">
        {GROUPS.map((group, index) => (
          <NavDropdown
            key={group.id}
            group={group}
            pathname={pathname}
            open={openId === group.id}
            onOpenChange={(next) =>
              setOpenMenu(next ? { id: group.id, pathname } : null)
            }
            align={
              index === 0
                ? "start"
                : index === GROUPS.length - 1
                  ? "end"
                  : "center"
            }
          />
        ))}
      </div>
    </nav>
  );
}
