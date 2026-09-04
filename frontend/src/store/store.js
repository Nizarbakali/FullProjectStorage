import { configureStore } from '@reduxjs/toolkit'
import chartsReducer     from './chartsSlice'
import navigationReducer from './navigationSlice'
import authReducer       from './authSlice'

export const store = configureStore({
  reducer: {
    charts:     chartsReducer,
    navigation: navigationReducer,
    auth:       authReducer,
  },
})
