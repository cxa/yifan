import React from 'react';
import { Heart } from 'lucide-react-native';

type FavoriteHeartIconProps = {
  size: number;
  isFavorited: boolean;
  activeColor: string;
  inactiveColor: string;
};

const FavoriteHeartIcon = ({
  size,
  isFavorited,
  activeColor,
  inactiveColor,
}: FavoriteHeartIconProps) => {
  const color = isFavorited ? activeColor : inactiveColor;
  return (
    <Heart size={size} color={color} fill={isFavorited ? color : 'none'} />
  );
};

export default FavoriteHeartIcon;
