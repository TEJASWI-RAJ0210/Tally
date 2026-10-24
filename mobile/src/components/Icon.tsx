import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type IconProps = {
  name: IconName;
  color: string;
  size?: number;
};

export default function Icon({ name, color, size = 22 }: IconProps) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}
