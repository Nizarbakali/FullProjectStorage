import { configureStore } from '@reduxjs/toolkit'
import chartsReducer from './chartsSlice'

export const store = configureStore({
  reducer: {
    charts: chartsReducer
  }
})
