"use client";

import { useState } from "react";
import { Calendar, Users, Settings, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Farm } from "@/types/schema";

interface FarmCardProps {
  farm: Farm;
  onAnoSafraClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

export function FarmCard({
  farm,
  onAnoSafraClick,
  onEditClick,
  onDeleteClick,
}: FarmCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Banner/Foto */}
      <div className="relative h-32 w-full bg-gradient-to-br from-green-400 to-green-600 overflow-hidden">
        {farm.image_url ? (
          <img
            src={farm.image_url}
            alt={farm.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/80">
            <span className="text-4xl font-bold">{farm.name.charAt(0)}</span>
          </div>
        )}
      </div>

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{farm.name}</h3>
            {farm.city && (
              <p className="text-sm text-muted-foreground mt-1">{farm.city}</p>
            )}
          </div>
        </div>
        {farm.description && (
          <CardDescription className="mt-2 line-clamp-2">
            {farm.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onAnoSafraClick}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Ano Safra
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled
          title="Em breve"
        >
          <Users className="mr-2 h-4 w-4" />
          Usuários
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditClick}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDeleteClick} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
