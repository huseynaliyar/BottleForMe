import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const canShowPickupMap = Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  || Constants.expoConfig?.extra?.androidRadarMap === true;
