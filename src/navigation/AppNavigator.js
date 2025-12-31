import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import ObjectConfirmationScreen from '../screens/ObjectConfirmationScreen';
import SearchScreen from '../screens/SearchScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PictureDetailsScreen from '../screens/PictureDetailsScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, next, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          };
        },
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'SnapFindMy',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          title: 'Take Picture',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      
      <Stack.Screen 
        name="ObjectConfirmation" 
        component={ObjectConfirmationScreen}
        options={{
          title: 'Confirm Objects',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          title: 'Find Objects',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="Gallery" 
        component={GalleryScreen}
        options={{
          title: 'Picture Gallery',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="ImageViewer" 
        component={ImageViewerScreen}
        options={{
          title: 'View Image',
          headerShown: false,
          presentation: 'modal',
        }}
      />
      
      <Stack.Screen 
        name="PictureDetails" 
        component={PictureDetailsScreen}
        options={{
          title: 'Picture Details',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerTintColor: '#333',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
    </Stack.Navigator>
  );
} 